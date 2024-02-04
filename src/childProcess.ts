import { init } from "z3-solver";

const { Context } = await init();
const { Solver, Int, And } = Context("main");

const x = Int.const("x");

// x.eq(0);

const solver = new Solver();
solver.add(And(x.ge(1), x.le(20)));
if ((await solver.check()) === "sat") {
  const model = solver.model();
  console.log("Satisfying assignment for x: " + model.get(x).toString());
} else {
  console.error("Conditions are not solvable.");
}
process.exit();
