import { createRoot } from "react-dom/client";
import { NodeEditor, GetSchemes, ClassicPreset } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import {
  ConnectionPlugin,
  Presets as ConnectionPresets,
} from "rete-connection-plugin";
import {
  ReactRenderPlugin,
  Presets,
  ReactArea2D,
} from "rete-react-render-plugin";
import {
  AutoArrangePlugin,
  Presets as ArrangePresets,
} from "rete-auto-arrange-plugin";
import {
  AddNode,
  NumberNode,
  InputNode,
  OutputNode,
  ModuleNode,
} from "./nodes";
import { DataflowEngine } from "rete-engine";
import {
  ContextMenuPlugin,
  ContextMenuExtra,
  Presets as ContextMenuPresets,
} from "rete-context-menu-plugin";
import { Modules } from "./modules";
import { clearEditor } from "./utils";
import { createNode, exportEditor, importEditor } from "./import";
import rootModule from "./modules/root.json";
import transitModule from "./modules/transit.json";
import doubleModule from "./modules/double.json";
import { createEngine } from "./processing";

const modulesData: { [key in string]: any } = {
  root: rootModule,
  transit: transitModule,
  double: doubleModule,
};

type Nodes = AddNode | NumberNode | InputNode | OutputNode | ModuleNode;
export type Schemes = GetSchemes<
  Nodes,
  | Connection<NumberNode, AddNode>
  | Connection<AddNode, AddNode>
  | Connection<InputNode, OutputNode>
>;
type AreaExtra = ReactArea2D<Schemes> | ContextMenuExtra<Schemes>;

export class Connection<
  S extends Nodes,
  T extends Nodes
> extends ClassicPreset.Connection<S, T> {}

export type Context = {
  process: () => void;
  modules: Modules<Schemes>;
  editor: NodeEditor<Schemes>;
  area: AreaPlugin<Schemes, any>;
  dataflow: DataflowEngine<Schemes>;
};

export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const render = new ReactRenderPlugin<Schemes>({ createRoot });
  const arrange = new AutoArrangePlugin<Schemes, AreaExtra>();

  arrange.addPreset(ArrangePresets.classic.setup());

  area.use(arrange);

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });

  render.addPreset(Presets.classic.setup({ area }));
  render.addPreset(Presets.contextMenu.setup());

  connection.addPreset(ConnectionPresets.classic.setup());

  editor.use(area);
  area.use(connection);
  area.use(render);

  AreaExtensions.simpleNodesOrder(area);
  AreaExtensions.showInputControl(area);

  const { dataflow, process } = createEngine(editor, area);

  editor.use(dataflow);

  const modules = new Modules<Schemes>(
    (path) => modulesData[path],
    async (path, editor) => {
      const data = modulesData[path];

      if (!data) throw new Error("cannot find module");
      await importEditor(
        {
          ...context,
          editor,
        },
        data
      );
    }
  );
  const context: Context = {
    editor,
    area,
    modules,
    dataflow,
    process,
  };

  const contextMenu = new ContextMenuPlugin<Schemes, AreaExtra>({
    items: ContextMenuPresets.classic.setup([
      ["Number", () => createNode(context, "Number", { value: 0 })],
      ["Add", () => createNode(context, "Add", {})],
      ["Input", () => createNode(context, "Input", { key: "key" })],
      ["Output", () => createNode(context, "Output", { key: "key" })],
      ["Module", () => createNode(context, "Module", { name: "" })],
    ]),
  });

  area.use(contextMenu);

  await process();

  let currentModulePath: null | string = null;

  async function openModule(path: string) {
    currentModulePath = null;

    await clearEditor(editor);

    const module = modules.findModule(path);

    if (module) {
      currentModulePath = path;
      await module.apply(editor);
    }

    await arrange.layout();
    AreaExtensions.zoomAt(area, editor.getNodes());
  }
  (window as any).area = area;

  return {
    getModules() {
      return Object.keys(modulesData);
    },
    saveModule: () => {
      if (currentModulePath) {
        const data = exportEditor(context);
        modulesData[currentModulePath] = data;
      }
    },
    restoreModule: () => {
      if (currentModulePath) openModule(currentModulePath);
    },
    newModule: (path: string) => {
      modulesData[path] = { nodes: [], connections: [] };
    },
    openModule,
    destroy: () => {
      console.log("area.destroy1", area.nodeViews.size);

      area.destroy();
    },
  };
}
