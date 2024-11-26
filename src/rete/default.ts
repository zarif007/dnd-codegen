import { ClassicPreset as Classic, GetSchemes, NodeEditor } from "rete";
import { Area2D, AreaPlugin } from "rete-area-plugin";
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from "rete-connection-plugin";
import {
  ReactPlugin,
  ReactArea2D,
  Presets as ReactPresets,
} from "rete-react-plugin";
import { createRoot } from "react-dom/client";

type Node = NumberNode | AddNode;
type Conn =
  | Connection<NumberNode, AddNode>
  | Connection<AddNode, AddNode>
  | Connection<AddNode, NumberNode>;

interface Process {
  type: "process";
}

type Schemes = GetSchemes<Node, Conn> & {
  Process: Process;
};

class Connection<A extends Node, B extends Node> extends Classic.Connection<
  A,
  B
> {}

const socket = new Classic.Socket("socket");

class NumberNode extends Classic.Node {
  private value: number;

  constructor(initial: number) {
    super("Number");
    this.value = initial;

    this.addOutput("value", new Classic.Output(socket, "Number"));
    this.addControl(
      "value",
      new Classic.InputControl("number", {
        initial,
        change: (v) => {
          if (typeof v === "number") {
            this.value = v;
            // Instead of trigger, we call process directly
            processNodes();
          }
        },
      })
    );
  }

  data() {
    return {
      value: this.value,
    };
  }
}

class AddNode extends Classic.Node {
  private result: number = 0;

  constructor() {
    super("Add");

    this.addInput("a", new Classic.Input(socket, "A"));
    this.addInput("b", new Classic.Input(socket, "B"));
    this.addOutput("value", new Classic.Output(socket, "Number"));

    this.addControl(
      "result",
      new Classic.InputControl("number", {
        initial: 0,
        readonly: true,
      })
    );
  }

  data(inputs: { a?: number[]; b?: number[] }) {
    const a = inputs.a?.[0] || 0;
    const b = inputs.b?.[0] || 0;
    this.result = a + b;

    const control = this.controls["result"] as Classic.InputControl<"number">;
    control.setValue(this.result);

    return {
      value: this.result,
    };
  }
}

let editor: NodeEditor<Schemes>;

function processNodes() {
  console.log("Processing nodes..."); // Debug log

  const nodes = Array.from(editor.getNodes());
  const processed = new Set<string>();

  const processNode = (nodeId: string) => {
    if (processed.has(nodeId)) return;

    const node = editor.getNode(nodeId);
    if (!node) return;

    const inputs = editor
      .getConnections()
      .filter((conn) => conn.target === nodeId)
      .reduce<Record<string, number[]>>((acc, conn) => {
        const sourceNode = editor.getNode(conn.source);
        if (!processed.has(conn.source)) {
          processNode(conn.source);
        }

        let value = 0;
        if (sourceNode instanceof NumberNode) {
          value = sourceNode.data().value;
        } else if (sourceNode instanceof AddNode) {
          value = sourceNode.data({}).value;
        }

        acc[conn.targetInput] = acc[conn.targetInput] || [];
        acc[conn.targetInput].push(value);
        return acc;
      }, {});

    if (node instanceof AddNode) {
      console.log("Processing AddNode with inputs:", inputs); // Debug log
      node.data(inputs);
    }

    processed.add(nodeId);
  };

  // Process all nodes
  nodes.forEach((node) => processNode(node.id));
}

export async function createEditor(container: HTMLElement) {
  console.log("new==========================");
  editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const reactRender = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

  editor.use(area);
  area.use(reactRender);
  area.use(connection);
  connection.addPreset(ConnectionPresets.classic.setup());
  reactRender.addPreset(ReactPresets.classic.setup());

  // Handle connection events
  editor.addPipe((context) => {
    if (
      context.type === "connectioncreated" ||
      context.type === "connectionremoved" ||
      context.type === "noderemoved"
    ) {
      processNodes();
    }
    return context;
  });

  // Create nodes
  const a = new NumberNode(2);
  const b = new NumberNode(2);
  const add = new AddNode();

  await editor.addNode(a);
  await editor.addNode(b);
  await editor.addNode(add);

  // Connect nodes
  await editor.addConnection(new Connection(a, "value", add, "a"));
  await editor.addConnection(new Connection(b, "value", add, "b"));

  // Position nodes
  await area.nodeViews.get(a.id)?.translate(100, 100);
  await area.nodeViews.get(b.id)?.translate(100, 300);
  await area.nodeViews.get(add.id)?.translate(400, 150);

  // Initial process
  processNodes();

  return {
    destroy: () => area.destroy(),
  };
}

type AreaExtra = Area2D<Schemes> | ReactArea2D<Schemes>;
