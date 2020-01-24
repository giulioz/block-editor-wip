import React, { useState, useRef } from "react";
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

const IOPort = React.forwardRef(
  ({ type = "input", label, ...rest }, ref) => (
    <div className={`io ${type}`} ref={ref} {...rest}>
      {type === "input" && (
        <>
          {"<"} {label}
        </>
      )}
      {type === "output" && (
        <>
          {label} {">"}
        </>
      )}
    </div>
  ),
);

function BlockTemplate({
  type,
  onMove = () => {},
  onMoveStart = () => {},
  onMoveEnd = () => {},
  inputs = [],
  outputs = [],
}) {
  const bind = useDrag(({ xy: [x, y], first, last }) => {
    if (first) onMoveStart({ x, y });
    if (last) onMoveEnd();
    onMove({ x: x, y: y });
  });

  return (
    <div {...bind()} className="block">
      <div className="topbar">
        <div className="title">{type}</div>
      </div>
      {inputs.map(input => (
        <IOPort key={input.uuid} type="input" {...input} />
      ))}
      {outputs.map(output => (
        <IOPort key={output.uuid} type="output" {...output} />
      ))}
    </div>
  );
}

function getIOStartPos(element, right) {
  const rect = element.getBoundingClientRect();
  return {
    x: right ? rect.right : rect.x,
    y: rect.y + rect.height / 2,
  };
}

function Block({
  x,
  y,
  type,
  onMove = () => {},
  onDelete = () => {},
  onDragIO = () => {},
  onDragIOStart = () => {},
  onDragIOEnd = () => {},
  inputs = [],
  outputs = [],
}) {
  const { px, py } = useSpring({
    px: x || 0,
    py: y || 0,
    config: springConfig.stiff,
  });

  const divRef = useRef();
  const bind = useDrag(({ delta: [px, py] }) => {
    if (x === undefined || y === undefined) {
      const rect = divRef.current.getBoundingClientRect();
      x = rect.x + rect.width / 2;
      y = rect.y;
    }

    onMove({ x: px + x, y: py + y });
  });

  const ioRefs = useRef({});
  const updateIORef = uuid => ref => {
    ioRefs.current[uuid] = ref;
  };

  const bindIO = useDrag(
    ({ xy: [px, py], first, last, args: [uuid, right], event }) => {
      if (first) {
        onDragIOStart(uuid, getIOStartPos(ioRefs.current[uuid], right));
      }

      onDragIO(uuid, { x: px, y: py });

      const lastElement = document.elementFromPoint(px, py);
      if (last) onDragIOEnd(uuid, getIOStartPos(lastElement));

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
      }}
    >
      <div className="topbar">
        <div className="title">{type}</div>
        <div className="deleteButton" onClick={onDelete}>
          x
        </div>
      </div>
      {inputs.map(input => (
        <IOPort
          type="input"
          key={input.uuid}
          ref={updateIORef(input.uuid)}
          {...bindIO(input.uuid, false)}
          {...input}
        />
      ))}
      {outputs.map(output => (
        <IOPort
          type="output"
          key={output.uuid}
          ref={updateIORef(output.uuid)}
          {...bindIO(output.uuid, true)}
          {...output}
        />
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
];

function View() {
  const [blocks, setBlocks] = useState([]);

  const [draggingTemplate, setDraggingTemplate] = useState(null);
  const handleMoveTemplateStart = type => pos => {
    const uuid = uuidv4();
    setBlocks(blocks => [
      ...blocks,
      { ...templates.find(t => t.type === type), ...pos, uuid },
    ]);
    setDraggingTemplate(uuid);
  };
  const handleMoveTemplate = pos =>
    setBlocks(blocks =>
      blocks.map(b =>
        b.uuid === draggingTemplate ? { ...b, ...pos } : b,
      ),
    );
  const handleMoveTemplateEnd = () => setDraggingTemplate(null);

  const handleMoveBlock = uuid => pos =>
    setBlocks(blocks =>
      blocks.map(block =>
        block.uuid === uuid ? { ...block, ...pos } : block,
      ),
    );
  const handleDeleteBlock = uuid => () =>
    setBlocks(blocks => blocks.filter(block => block.uuid !== uuid));

  const [links, setLinks] = useState([
    // { ax: 150, ay: 50, bx: 300, by: 300 },
  ]);
  function handleDragIOStart(uuid, { x, y }) {
    setLinks(links => [
      { uuid, ax: x, ay: y, bx: x, by: y },
      ...links.filter(l => l.uuid !== uuid),
    ]);
  }
  function handleDragIO(uuid, { x, y }) {
    setLinks(links =>
      links.map(l => (l.uuid === uuid ? { ...l, bx: x, by: y } : l)),
    );
  }
  function handleDragIOEnd(uuid, { x, y }) {
    setLinks(links =>
      links.map(l => (l.uuid === uuid ? { ...l, bx: x, by: y } : l)),
    );
  }

  return (
    <>
      {links.map(link => (
        <Link {...link} key={link.uuid + "link"} />
      ))}

      <div className="drawer">
        {templates.map(block => (
          <BlockTemplate
            {...block}
            key={block.type}
            onMove={handleMoveTemplate}
            onMoveStart={handleMoveTemplateStart(block.type)}
            onMoveEnd={handleMoveTemplateEnd}
          />
        ))}
      </div>

      {blocks.map(block => (
        <Block
          {...block}
          key={block.uuid}
          onMove={handleMoveBlock(block.uuid)}
          onDelete={handleDeleteBlock(block.uuid)}
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
