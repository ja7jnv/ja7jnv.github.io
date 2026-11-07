(() => {
  "use strict";

  const DIGITS = {
    0: "abcdef",
    1: "bc",
    2: "abdeg",
    3: "abcdg",
    4: "bcfg",
    5: "acdfg",
    6: "acdefg",
    7: "abcf",
    8: "abcdefg",
    9: "abcdfg",
  };
  const OPERATORS = {
    "+": ["horizontal", "vertical"],
    "-": ["horizontal"],
    "*": ["diagonal_left", "diagonal_right"],
  };
  const EQUALS = ["equal_upper", "equal_lower"];
  const SPECIAL_TRANSFORMATIONS = new Set(["7:11", "4:11"]);
  const MAX_NUMBER = 99;

  const form = document.querySelector("#puzzle-form");
  const expressionInput = document.querySelector("#expression");
  const output = document.querySelector("#output");

  function matchsticksForNumber(number) {
    const sticks = new Set();
    String(number).split("").forEach((digit, digitIndex) => {
      for (const segment of DIGITS[digit]) {
        sticks.add(`${digitIndex}:${segment}`);
      }
    });
    return sticks;
  }

  function matchsticksForExpression(left, operator, right, result) {
    const sticks = new Set();
    for (const [position, number] of [
      ["left", left],
      ["right", right],
      ["result", result],
    ]) {
      for (const stick of matchsticksForNumber(number)) {
        sticks.add(`${position}:${stick}`);
      }
    }
    for (const stick of OPERATORS[operator]) {
      sticks.add(`operator:${stick}`);
    }
    for (const stick of EQUALS) {
      sticks.add(`equals:${stick}`);
    }
    return sticks;
  }

  function isCorrectEquation(left, operator, right, result) {
    return (
      (operator === "+" && left + right === result) ||
      (operator === "-" && left - right === result) ||
      (operator === "*" && left * right === result)
    );
  }

  function isTwoMoveSpecialTransformation(
    left,
    operator,
    right,
    result,
    newLeft,
    newOperator,
    newRight,
    newResult,
  ) {
    if (!isCorrectEquation(newLeft, newOperator, newRight, newResult)) {
      return false;
    }
    if (newOperator !== operator || newResult !== result) {
      return false;
    }
    return (
      (SPECIAL_TRANSFORMATIONS.has(`${left}:${newLeft}`) &&
        right === newRight) ||
      (SPECIAL_TRANSFORMATIONS.has(`${right}:${newRight}`) &&
        left === newLeft)
    );
  }

  function isReorderedEquation(left, operator, right, result) {
    return operator === "-" && left === right - result;
  }

  function findSolutions(left, operator, right, result) {
    const original = matchsticksForExpression(left, operator, right, result);
    const solutions = [];
    const solutionSet = new Set();

    const addSolution = (expression) => {
      if (!solutionSet.has(expression)) {
        solutionSet.add(expression);
        solutions.push(expression);
      }
    };

    if (isReorderedEquation(left, operator, right, result)) {
      addSolution(`${left} = ${right} ${operator} ${result}`);
    }

    for (let newLeft = 0; newLeft <= MAX_NUMBER; newLeft += 1) {
      for (let newRight = 0; newRight <= MAX_NUMBER; newRight += 1) {
        for (let newResult = 0; newResult <= MAX_NUMBER; newResult += 1) {
          for (const newOperator of Object.keys(OPERATORS)) {
            const isValid = isCorrectEquation(
              newLeft,
              newOperator,
              newRight,
              newResult,
            );
            const isSpecial = isTwoMoveSpecialTransformation(
              left,
              operator,
              right,
              result,
              newLeft,
              newOperator,
              newRight,
              newResult,
            );
            if (!isValid && !isSpecial) {
              continue;
            }

            const candidate = matchsticksForExpression(
              newLeft,
              newOperator,
              newRight,
              newResult,
            );
            let removedCount = 0;
            let addedCount = 0;
            for (const stick of original) {
              if (!candidate.has(stick)) {
                removedCount += 1;
              }
            }
            for (const stick of candidate) {
              if (!original.has(stick)) {
                addedCount += 1;
              }
            }

            const oneMove = removedCount === 1 && addedCount === 1;
            const twoMoves = removedCount === 2 && addedCount === 2;
            if (oneMove || (isSpecial && twoMoves)) {
              addSolution(
                `${newLeft} ${newOperator} ${newRight} = ${newResult}`,
              );
            }
          }
        }
      }
    }
    return solutions;
  }

  function parseExpression(expression) {
    const match = /^\s*(\d+)\s*([+\-*])\s*(\d+)\s*=\s*(\d+)\s*$/.exec(
      expression,
    );
    if (!match) {
      throw new Error("入力形式は x [+-*] y = z です。");
    }

    const [, leftText, operator, rightText, resultText] = match;
    const values = [leftText, rightText, resultText].map(Number);
    if (values.some((value) => value > MAX_NUMBER)) {
      throw new Error(`x, y, z は 0以上${MAX_NUMBER}以下の整数にしてください。`);
    }
    if (isCorrectEquation(values[0], operator, values[1], values[2])) {
      throw new Error("入力された式は、数学的に正しくない式にしてください。");
    }
    return [values[0], operator, values[1], values[2]];
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    output.classList.remove("error");

    try {
      const [left, operator, right, result] = parseExpression(
        expressionInput.value,
      );
      const solutions = findSolutions(left, operator, right, result);
      output.textContent = solutions.length
        ? `解:\n${solutions.join("\n")}`
        : "1本のマッチ棒を移動して成立する式はありません。";
    } catch (error) {
      output.classList.add("error");
      output.textContent = `入力エラー: ${error.message}`;
    }
  });
})();
