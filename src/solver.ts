// Example 1

// import { init } from "z3-solver";
// const { Context } = await init();
// const { Solver, Int, And } = Context("main");

// const x = Int.const("x");

// const solver = new Solver();
// solver.add(And(x.eq(0), x.ge(1), x.le(20)));
// console.log(await solver.check());
// try {
//   const model = solver.model();
//   console.log(model.get(x).toString());
// } catch (e: unknown) {
//   console.error(e instanceof Error ? e.message : e);
// }

// Example 2 (from chatGPT)

// import { init } from "z3-solver";
// const { Context } = await init();
// const { Solver, Int, And } = Context("main");

// // Create a Z3 context
// const solver = new Solver();

// // Define the variable x as an integer
// const x = Int.const("x");

// // Add the conditions to the solver
// solver.add(x.gt(18));
// solver.add(And(x.gt(1), x.lt(20)));

// // Check if the conditions are solvable
// const result = await solver.check();

// if (result === "sat") {
//   // If solvable, get the model
//   const model = solver.model();
//   // Print the satisfying assignment for x
//   console.log("Satisfying assignment for x:", model.eval(x, true).toString());
// } else {
//   console.log("Conditions are not solvable.");
// }

// Example 3 (from the source code)

// import { init } from "z3-solver";
// const { Context, em } = await init();
// const { Solver, Int } = Context("main");
// const x = Int.const("x");
// const y = Int.const("y");
// const solver = new Solver();
// solver.add(x.add(2).le(y.sub(10))); // x + 2 <= y - 10
// if ((await solver.check()) !== "sat") {
//   throw new Error("couldn't find a solution");
// }
// const model = solver.model();
// console.log(`x=${model.get(x)}, y=${model.get(y)}`);
// // x=0, y=12
// // exit process: https://github.com/Z3Prover/z3/issues/7070#issuecomment-1871017371
// em.PThread.terminateAllThreads();

// Example 4 (updated example 3 with IIFE like in the official example)
// https://github.com/Z3Prover/z3/blob/master/src/api/js/examples/high-level/using_smtlib2.ts

// import process from "process";
// import { init } from "z3-solver";

// (async () => {
//   const { Context } = await init();
//   const { Solver, Int } = Context("main");
//   const x = Int.const("x");
//   const y = Int.const("y");
//   const solver = new Solver();
//   solver.add(x.add(2).le(y.sub(10))); // x + 2 <= y - 10
//   if ((await solver.check()) !== "sat") {
//     throw new Error("couldn't find a solution");
//   }
//   const model = solver.model();
//   console.log(`x=${model.get(x)}, y=${model.get(y)}`);
//   // x=0, y=12
//   process.exit(0);
// })().catch((e) => {
//   console.error("error", e);
//   process.exit(1);
// });

// Example 5 (from https://microsoft.github.io/z3guide/programming/Z3%20JavaScript%20Examples)

// import { init } from "z3-solver";
// const { Context } = await init();
// const { Bool, Or, Implies, Not, solve } = Context("main");

// const [tie, shirt] = [Bool.const("tie"), Bool.const("shirt")];
// const result = await solve(
//   Or(tie, shirt),
//   Implies(tie, shirt),
//   Or(Not(tie), Not(shirt))
// );
// console.log(result.toString());
// // (define-fun tie () Bool
// //   false)
// // (define-fun shirt () Bool
// //   true)
// process.exit(0);

// Example 6 (inside child process)

// import { spawn } from "child_process";

// const command = "node";
// const scriptPath = "./dist/childProcess";
// const args = [scriptPath];

// // Spawn the child process
// // const result = spawnSync(command, args);
// // console.log(result.output.toString());
// const childProcess = spawn(command, args);

// // Listen for output events
// childProcess.stdout.on("data", (data) => {
//   console.log(`stdout: ${data}`);
// });

// childProcess.stderr.on("data", (data) => {
//   console.error(`stderr: ${data}`);
// });

// console.log("Hello after exited child process");

// #################################################################################
// #                                                                               #
// #                                 Example 7                                     #
// #                                                                               #
// #################################################################################

// business rules:
// - alcohol forbidden for < 16 years old
// - alcohol level > 5° forbidden for < 18 years old
// -> alcohol level < 5° allowed between 16 and 18 years old

// zmodel policy rules:
// @@allow('read', (auth().age > 16 && alcoholLevel < 5) || auth().age > 18)

import { type Arith, type Bool, init } from "z3-solver";
import { killThreads } from "./utils";

async function checker(args: Filter, user?: any) {
  const { Context, em } = await init();
  const { Solver, Int, Or, And } = Context("main");
  const userAge = Int.const("user.age"); // to generate dynamically
  const alcoholLevel = Int.const("alcoholLevel"); // to generate dynamically
  const variables = { userAge, alcoholLevel }; // to generate dynamically
  const solver = new Solver();
  console.log("args", args);
  const assertions = buildAssertions(variables, Or, And, args, user);
  solver.add(...assertions);
  solver.add(
    Or(userAge.ge(18), And(userAge.ge(16), alcoholLevel.lt(5))) // to generate dynamically
  );
  if ((await solver.check()) === "sat") {
    const model = solver.model();
    console.log(`userAge=${model.get(userAge)}`);
    console.log(`alcoholLevel=${model.get(alcoholLevel)}`);
    await killThreads(em);
    return true;
  } else {
    console.error("couldn't find a solution");
    await killThreads(em);
    return false;
  }
}

type Operator = "eq" | "ne" | "lt" | "le" | "gt" | "ge";
type NumericComparison = Partial<{ [k in Operator]: number }>;
type NumericCondition = NumericComparison | number;
type OrCondition = { OR: NumericCondition[] | OrCondition[] };
type RangeFilter = Record<string, OrCondition | NumericCondition>;
type OrFilter = { OR: RangeFilter[] | OrFilter[] };
type Filter = RangeFilter | OrFilter;
type Assertion = Bool<"main">;
type NumberExpr = Arith<"main">;

const processCondition = (
  variable: NumberExpr,
  condition: NumericCondition | OrCondition,
  Or: (...args: Assertion[]) => Assertion,
  And: (...args: Assertion[]) => Assertion
): Assertion[] => {
  const assertions: Assertion[] = [];
  if (typeof condition === "number") {
    assertions.push(variable.eq(condition));
  } // handle OR condition
  else if ("OR" in condition) {
    const orCondition = condition as OrCondition;
    const tempAssertions: Assertion[] = [];
    for (const condition of orCondition.OR) {
      tempAssertions.push(...processCondition(variable, condition, Or, And));
    }
    const orAssertion = Or(...tempAssertions);
    assertions.push(orAssertion);
  } else {
    const tempAssertions: Assertion[] = [];
    for (const [operator, value] of Object.entries(condition)) {
      switch (operator) {
        case "eq":
          tempAssertions.push(variable.eq(value));
          break;
        case "ne":
          tempAssertions.push(variable.neq(value));
          break;
        case "lt":
          tempAssertions.push(variable.lt(value));
          break;
        case "le":
          tempAssertions.push(variable.le(value));
          break;
        case "gt":
          tempAssertions.push(variable.gt(value));
          break;
        case "ge":
          tempAssertions.push(variable.ge(value));
          break;
        default:
          throw new Error("Invalid operator");
      }
    }
    const andAssertion = And(...tempAssertions);
    assertions.push(andAssertion);
  }
  return assertions;
};

const processFilter = (
  variables: Record<string, NumberExpr>,
  Or: (...args: Assertion[]) => Assertion,
  And: (...args: Assertion[]) => Assertion,
  filter: Filter,
  isUserFilter: boolean = false
): Assertion[] => {
  const assertions: Assertion[] = [];
  if ("OR" in filter) {
    const orFilter = filter as OrFilter;
    console.log("orFilter", orFilter.OR);
    const tempAssertions: Assertion[] = [];
    for (const filter of orFilter.OR) {
      tempAssertions.push(...processFilter(variables, Or, And, filter));
    }
    const orAssertion = Or(...tempAssertions);
    assertions.push(orAssertion);
  }
  for (const [property, condition] of Object.entries(filter)) {
    const renamedProperty = isUserFilter ? `user.${property}` : property;
    const variable = variables[renamedProperty];
    if (variable) {
      assertions.push(And(...processCondition(variable, condition, Or, And)));
    }
  }
  return assertions;
};

export const buildAssertions = (
  variables: Record<string, NumberExpr>,
  Or: (...args: Assertion[]) => Assertion,
  And: (...args: Assertion[]) => Assertion,
  args: Filter = {},
  user: RangeFilter = {}
): Assertion[] => {
  const variableRegistry = {} as Record<string, NumberExpr>;
  for (const name in variables) {
    const realName = variables[name].name() as string;
    variableRegistry[realName] = variables[name];
  }
  const argsAssertions = processFilter(variableRegistry, Or, And, args);
  const userAssertions = processFilter(variableRegistry, Or, And, user, true);
  const assertions = [...argsAssertions, ...userAssertions];
  console.log(
    "assertions",
    assertions.map((a) => a.toString())
  );
  return assertions;
};

// ###############    TESTS     ###############

// Without args
const result = await checker({});
console.log("result", result); // true -> however age should be defined I guess

// With simple args
const result2 = await checker({ alcoholLevel: { ge: 10, lt: 9 } });
console.log("result2", result2); // false

// With args and user
const result3 = await checker(
  { alcoholLevel: { ge: 3, lt: 10 } },
  { age: { lt: 15 } }
);
console.log("result3", result3); // false

// with invalid args -> filtered
const result4 = await checker(
  { alcoholLevel: { ge: 3, lt: 10 }, unknownArg: 0 },
  { age: 16 }
);
console.log("result4", result4); // true

// with OR filter
const result5 = await checker(
  {
    OR: [{ alcoholLevel: { ge: 1, le: 5 } }, { alcoholLevel: { lt: 20 } }],
    alcoholLevel: { ge: 2, lt: 10 },
  },
  { age: 17 }
);
console.log("result5", result5); // true

// with OR condition
const result6 = await checker(
  {
    alcoholLevel: {
      OR: [
        { ge: 20, lt: 10 },
        { ge: 1, lt: 2 },
      ],
    },
  },
  { age: 16 }
);
console.log("result6", result6); // true
