import { ClassicPreset as Classic } from "rete";
import { DataflowNode } from "rete-engine";
import { socket } from "../sockets";

export class CompareNode
  extends Classic.Node<
    { left: Classic.Socket; right: Classic.Socket },
    { value: Classic.Socket },
    { result: Classic.InputControl<"text"> }
  >
  implements DataflowNode
{
  width = 180;
  height = 190;
  constructor(
    change?: (value: number) => void,
    initial?: { left?: number; right?: number }
  ) {
    super("Compare");
    const left = new Classic.Input(socket, "Left");
    const right = new Classic.Input(socket, "Right");

    left.addControl(
      new Classic.InputControl("number", {
        initial: initial?.left || 0,
        change,
      })
    );
    right.addControl(
      new Classic.InputControl("number", {
        initial: initial?.right || 0,
        change,
      })
    );

    this.addInput("left", left);
    this.addInput("right", right);
    this.addOutput("value", new Classic.Output(socket, "Number"));
    this.addControl(
      "result",
      new Classic.InputControl("text", { initial: "", readonly: true })
    );
  }
  data(inputs: { left?: number[]; right?: number[] }) {
    const { left = [], right = [] } = inputs;

    const leftControl = this.inputs["left"]?.control;
    const rightControl = this.inputs["right"]?.control;

    const nodeA =
      left[0] || (leftControl as Classic.InputControl<"number">).value || 0;
    const nodeB =
      right[0] || (rightControl as Classic.InputControl<"number">).value || 0;

    const sum = nodeA - nodeB;

    let greater = "Node A";
    if (nodeA < nodeB) greater = "Node B";

    (this.controls["result"] as Classic.InputControl<"text">).setValue(greater);

    return {
      value: Math.max(nodeA, nodeB),
    };
  }

  serialize() {
    const leftControl = this.inputs["left"]?.control;
    const rightControl = this.inputs["right"]?.control;

    return {
      left: (leftControl as Classic.InputControl<"number">).value,
      right: (rightControl as Classic.InputControl<"number">).value,
    };
  }
}
