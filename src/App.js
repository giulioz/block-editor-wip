import React, { useState, useRef, useEffect } from "react";
import {
  useSpring,
  animated,
  config as springConfig,
} from "react-spring";
import { useDrag } from "react-use-gesture";
import { CssBaseline } from "@material-ui/core";
import * as d3 from "d3";

import "./styles.css";

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    function(c) {
      const r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
}

function Block({
  x,
  y,
  type,
  onMove = () => {},
  onMoveEnd = () => {},
  onDelete = () => {},
  onDragIO = () => {},
  onDragIOStart = () => {},
  onDragIOEnd = () => {},
  inputs = [],
  outputs = [],
}) {
  const divRef = useRef();

  const { px, py } = useSpring({
    px: x || 0,
    py: y || 0,
    config: springConfig.stiff,
  });

  const [dragging, setDragging] = useState(false);
  const bind = useDrag(({ delta: [px, py], last, first }) => {
    if (first) setDragging(true);

    if (x === undefined || y === undefined) {
      const rect = divRef.current.getBoundingClientRect();
      x = rect.x + rect.width / 2;
      y = rect.y;
    }

    onMove({ x: px + x, y: py + y });

    if (last) {
      setDragging(false);
      onMoveEnd();
    }
  });

  const ioRefs = useRef({});
  const updateIORef = uuid => ref => {
    ioRefs.current[uuid] = ref;
  };

  const bindIO = useDrag(
    ({ xy: [px, py], first, last, args: [uuid, right], event }) => {
      if (first) {
        const rect = ioRefs.current[uuid].getBoundingClientRect();
        onDragIOStart(
          uuid,
          {
            x: right ? rect.right : rect.x,
            y: rect.y + rect.height / 2,
          },
          { mx: px, my: py },
        );
      }

      onDragIO(uuid, { x: px, y: py });
      if (last) onDragIOEnd(uuid);

      event.stopPropagation();
    },
  );

  return (
    <animated.div
      {...bind()}
      ref={divRef}
      className="block"
      style={{
        left: px,
        top: py,
        // position: dragging ? "absolute" : undefined
      }}
    >
      <div className="topbar">
        <div className="title">{type}</div>
        <div className="deleteButton" onClick={onDelete}>
          x
        </div>
      </div>
      {inputs.map(input => (
        <div
          className="io input"
          key={input.uuid}
          ref={updateIORef(input.uuid)}
          {...bindIO(input.uuid, false)}
        >
          {"<"} {input.label}
        </div>
      ))}
      {outputs.map(output => (
        <div
          className="io output"
          key={output.uuid}
          ref={updateIORef(output.uuid)}
          {...bindIO(output.uuid, true)}
        >
          {output.label} {">"}
        </div>
      ))}
    </animated.div>
  );
}

function Link({
  ax = 100,
  ay = 0,
  bx = 200,
  by = 50,
  strokeWidth = 3,
}) {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  const width = Math.max(ax, bx) - x;
  const height = Math.max(ay, by) - y;

  const src = {
    x: ax - x + strokeWidth / 2,
    y: ay - y + strokeWidth / 2,
  };
  const dst = {
    x: bx - x + strokeWidth / 2,
    y: by - y + strokeWidth / 2,
  };

  const link = `M${src.x},${src.y}C${(src.x + dst.x) / 2},${
    src.y
  } ${(src.x + dst.x) / 2},${dst.y} ${dst.x},${dst.y}`;

  return (
    <svg
      className="svglink"
      style={{
        left: x,
        top: y,
      }}
      width={width + strokeWidth}
      height={height + strokeWidth}
    >
      <path
        d={link}
        stroke="red"
        strokeWidth={strokeWidth}
        fill="none"
      />
    </svg>
  );
}

const templates = [
  {
    type: "Camera Input",
    inputs: [],
    outputs: [{ label: "Frame", uuid: uuidv4() }],
  },
  {
    type: "Chroma Key",
    inputs: [
      { label: "Color", uuid: uuidv4() },
      { label: "Radius", uuid: uuidv4() },
      { label: "Frame", uuid: uuidv4() },
    ],
    outputs: [{ label: "Mask", uuid: uuidv4() }],
  },
  {
    type: "Hough Transf",
    inputs: [{ label: "Mask", uuid: uuidv4() }],
    outputs: [
      { label: "Angle", uuid: uuidv4() },
      { label: "Distance", uuid: uuidv4() },
    ],
  },
  {
    type: "RANSAC",
    inputs: [{ label: "Mask", uuid: uuidv4() }],
    outputs: [
      { label: "Angle", uuid: uuidv4() },
      { label: "Distance", uuid: uuidv4() },
    ],
  },
  {
    type: "Display Frame",
    inputs: [{ label: "Frame", uuid: uuidv4() }],
    outputs: [],
  },
  {
    type: "Draw Line",
    inputs: [
      { label: "Frame", uuid: uuidv4() },
      { label: "Angle", uuid: uuidv4() },
      { label: "Distance", uuid: uuidv4() },
    ],
    outputs: [{ label: "Frame", uuid: uuidv4() }],
  },
  {
    type: "RGB to YUV",
    inputs: [{ label: "Frame", uuid: uuidv4() }],
    outputs: [{ label: "Frame", uuid: uuidv4() }],
  },
].map(t => ({ ...t, template: true }));

function View() {
  const [blocks, setBlocks] = useState(templates);

  const handleMove = uuid => pos =>
    setBlocks(blocks =>
      blocks.map(block =>
        block.uuid === uuid ? { ...block, ...pos } : block,
      ),
    );

  const handleMoveTemplate = type => pos =>
    setBlocks(blocks =>
      blocks.map(block =>
        block.template && block.type === type
          ? { ...block, ...pos }
          : block,
      ),
    );

  const handleMoveEnd = type => () =>
    setBlocks(blocks => {
      const disabledTemplate = blocks.map(block =>
        block.type === type
          ? { ...block, template: false, uuid: block.uuid || uuidv4() }
          : block,
      );

      const currentTemplates = disabledTemplate.filter(b => b.template);
      const missing = templates.filter(
        t =>
          currentTemplates.filter(c => t.type === c.type).length === 0,
      );

      return [...disabledTemplate, ...missing];
    });

  const handleDelete = uuid => () =>
    setBlocks(blocks => blocks.filter(block => block.uuid !== uuid));

  const templatesToRender = blocks
    .filter(b => b.template)
    .sort((a, b) => a.type.localeCompare(b.type));
  const blocksToRender = blocks.filter(b => !b.template);

  const [links, setLinks] = useState([
    // { ax: 150, ay: 50, bx: 300, by: 300 },
  ]);

  function handleDragIOStart(uuid, { x, y }, { mx, my }) {
    setLinks(links => [
      { uuid, ax: x, ay: y, bx: mx, by: my },
      ...links.filter(l => l.uuid !== uuid),
    ]);
  }

  function handleDragIO(uuid, { x, y }) {
    setLinks(links =>
      links.map(l => (l.uuid === uuid ? { ...l, bx: x, by: y } : l)),
    );
  }

  function handleDragIOEnd(uuid, { x, y }, { mx, my }) {
    setLinks(links => [
      { uuid, ax: x, ay: y, bx: mx, by: my },
      ...links.filter(l => l.uuid !== uuid),
    ]);
  }

  return (
    <>
      {links.map(link => (
        <Link {...link} key={link.uuid + "link"} />
      ))}

      <div className="drawer">
        {templatesToRender.map(block => (
          <Block
            {...block}
            key={block.type}
            onMove={handleMoveTemplate(block.type)}
            onMoveEnd={handleMoveEnd(block.type)}
          />
        ))}
      </div>

      {blocksToRender.map(block => (
        <Block
          {...block}
          key={block.uuid}
          onMove={handleMove(block.uuid)}
          onDelete={handleDelete(block.uuid)}
          onDragIOStart={handleDragIOStart}
          onDragIO={handleDragIO}
          onDragIOEnd={handleDragIOEnd}
        />
      ))}
    </>
  );
}

export default function App() {
  return (
    <>
      <CssBaseline />
      <View />
    </>
  );
}