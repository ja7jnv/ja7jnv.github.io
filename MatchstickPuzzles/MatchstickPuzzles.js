(() => {            // IIFE
  "use strict";     // strict mode を有効化して、より安全なJavaScriptコードを実行する。

  /**
   * 数字と演算子のマッチ棒セグメントの対応表
   *  + a +
   *  f   b
   *  + g +
   *  e   c
   *  + d +
   */
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
  const expressionGuide = document.querySelector("#expression-guide");
  const answerVisual = document.querySelector("#answer-visual");

  /**
   * 単一文字のマッチ棒グラフィック要素（HTML）を生成する
   * 入力パラメタ: 
   *   - character {string}: 描画対象の1文字（数字, '+', '-', '*', '=' など）
   * 出力値: 
   *   - {HTMLSpanElement}: マッチ棒セグメントが組み込まれたspan要素
   * 関数の処理概要:
   *   1. 外枠となる span.matchstick-glyph 要素を生成する。
   *   2. 読み上げ用（aria-label）属性を設定する（'*' は '×' に変換）。
   *   3. 入力文字に対応するマッチ棒セグメント（表示位置）の配列を取得する。
   *   4. 各セグメントに対応する span.matchstick-segment 要素を生成し、外枠に追加して返す。
   */
  function createGlyph(character) {
    const glyph = document.createElement("span");
    glyph.className = "matchstick-glyph";
    glyph.setAttribute("aria-label", character === "*" ? "×" : character);

    const segments = DIGITS[character]
      ? [...DIGITS[character]]
      : character === "+"
        ? ["operator_horizontal", "operator_vertical"]
        : character === "-"
          ? ["operator_horizontal"]
          : character === "*"
            ? ["operator_diagonal_left", "operator_diagonal_right"]
            : character === "="
              ? ["equal_upper", "equal_lower"]
              : [];
    for (const segment of segments) {
      const stick = document.createElement("span");
      stick.className = `matchstick-segment segment-${segment}`;
      glyph.append(stick);
    }
    return glyph;
  }

  /**
   * 指定コンテナに文字列全体のマッチ棒グラフィックを追記する
   * 入力パラメタ: 
   *   - container {HTMLElement}: グラフィックを追加する親DOM要素
   *   - text {string}: 描画したい文字列
   * 出力値: 
   *   - なし (void)
   * 関数の処理概要:
   *   1. 入力文字列を1文字ずつ処理する。
   *   2. 空白の場合は空白用の span.matchstick-space を追加する。
   *   3. 文字の場合は createGlyph を使って生成した要素を追加する。
   */
  function appendMatchstickText(container, text) {
    for (const character of text) {
      if (character === " ") {
        const space = document.createElement("span");
        space.className = "matchstick-space";
        container.append(space);
      } else {
        container.append(createGlyph(character));
      }
    }
  }

  /**
   * 指定コンテナの中身をクリアし、文字列全体のマッチ棒グラフィックを再描画する
   * 入力パラメタ: 
   *   - container {HTMLElement}: 描画先の親DOM要素
   *   - text {string}: 描画したい文字列
   * 出力値: 
   *   - なし (void)
   * 関数の処理概要:
   *   1. container 内の既存要素をすべて削除（クリア）する。
   *   2. appendMatchstickText を呼び出して新しいグラフィック群を描画する。
   */
  function renderMatchstickText(container, text) {
    container.replaceChildren();
    appendMatchstickText(container, text);
  }

  /**
   * 元の数式と解決策（正解の式）のビジュアル比較表示を描画する
   * 入力パラメタ: 
   *   - inputExpression {string}: ユーザーが入力した元の数式文字列
   *   - solutions {Array<string>}: 見つかった解（数式文字列）の配列
   * 出力値: 
   *   - なし (void)
   * 関数の処理概要:
   *   1. answerVisual DOM要素の中身をクリアする。
   *   2. 各解について、「元の式 ⇢ 解決後の式」の形式でマッチ棒テキストと矢印、区切り文字（"または"）を組み立てて表示する。
   */
  function renderExpressionAnswer(inputExpression, solutions) {
    answerVisual.replaceChildren();
    for (const [index, solution] of solutions.entries()) {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "answer-separator";
        separator.textContent = "または";
        answerVisual.append(separator);
      }
      appendMatchstickText(answerVisual, inputExpression);
      appendMatchstickText(answerVisual, " ");
      const arrow = document.createElement("span");
      arrow.className = "answer-arrow";
      arrow.textContent = "⇢";
      answerVisual.append(arrow);
      appendMatchstickText(answerVisual, " ");
      appendMatchstickText(answerVisual, solution);
    }
  }

  function renderExpressionProblem(problemExpressions, answerExpression) {
    answerVisual.replaceChildren();
    for (const [index, problem] of problemExpressions.entries()) {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "answer-separator";
        separator.textContent = "または";
        answerVisual.append(separator);
      }
      appendMatchstickText(answerVisual, problem);
      appendMatchstickText(answerVisual, " ");
      const arrow = document.createElement("span");
      arrow.className = "answer-arrow";
      arrow.textContent = "⇢";
      answerVisual.append(arrow);
      appendMatchstickText(answerVisual, " ");
      appendMatchstickText(answerVisual, answerExpression);
    }
  }

  renderMatchstickText(expressionGuide, "0123456789+-* ");

  /**
   * 数値（複数桁可）を構成するマッチ棒の位置集合（Set）を生成する
   * 入力パラメタ: 
   *   - number {number|string}: 対象の数値
   * 出力値: 
   *   - {Set<string>}: "桁インデックス:セグメント名" の文字列集合
   * 関数の処理概要:
   *   1. 数値を文字列化して桁ごとに分解する。
   *   2. 各桁の数字に対応するセグメント文字を取得し、桁位置を付与した識別子（例: "0:a"）としてSetに追加して返す。
   */
  function matchsticksForNumber(number) {
    const sticks = new Set();
    String(number).split("").forEach((digit, digitIndex) => {
      for (const segment of DIGITS[digit]) {
        sticks.add(`${digitIndex}:${segment}`);
      }
    });
    return sticks;
  }

  /**
   * 数式全体（左辺・演算子・右辺・結果・等号）を構成する全マッチ棒の識別子集合を生成する
   * 入力パラメタ: 
   *   - left {number}: 左辺の数値
   *   - operator {string}: 演算子 ("+", "-", "*")
   *   - right {number}: 右辺の数値
   *   - result {number}: 計算結果の数値
   * 出力値: 
   *   - {Set<string>}: "場所:詳細位置" 形式の識別子集合
   * 関数の処理概要:
   *   1. 左辺、右辺、結果の数値について matchsticksForNumber を呼び出し、各領域の識別子（例: "left:0:a"）を生成する。
   *   2. 演算子および等号を構成するマッチ棒の識別子を追加して全体集合を返す。
   */
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

  /**
   * 与えられた数式が数学的に正しいか判定する
   * 入力パラメタ: 
   *   - left {number}: 左辺の数値
   *   - operator {string}: 演算子 ("+", "-", "*")
   *   - right {number}: 右辺の数値
   *   - result {number}: 計算結果の数値
   * 出力値: 
   *   - {boolean}: 数式として正しければ true、誤りなら false
   * 関数の処理概要:
   *   1. 演算子に応じて left と right の計算（加算・減算・乗算）を行う。
   *   2. 計算結果が result と一致するかどうかを判定する。
   */
  function isCorrectEquation(left, operator, right, result) {
    return (
      (operator === "+" && left + right === result) ||
      (operator === "-" && left - right === result) ||
      (operator === "*" && left * right === result)
    );
  }

  /**
   * 2本移動の特殊変形ルール（例: 7→11、4→11などへの変換）に合致するか判定する
   * 入力パラメタ: 
   *   - left, operator, right, result {number|string}: 変換前の数式要素
   *   - newLeft, newOperator, newRight, newResult {number|string}: 変換後の数式要素
   * 出力値: 
   *   - {boolean}: 特殊変形ルールに適合すれば true、そうでなければ false
   * 関数の処理概要:
   *   1. 変換後の式が数学的に正しいかチェックする。
   *   2. 演算子と結果値が変化していないことを確認する。
   *   3. 左右いずれかの数値が SPECIAL_TRANSFORMATIONS 定義内のペア（"7:11" や "4:11"）に該当するか確認する。
   */
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

  /**
   * 引き算の項を入れ替えた再配置形式（例: a - b = c ➔ a = b - c）に合致するか判定する
   * 入力パラメタ: 
   *   - left {number}: 左辺の数値
   *   - operator {string}: 演算子
   *   - right {number}: 右辺の数値
   *   - result {number}: 計算結果の数値
   * 出力値: 
   *   - {boolean}: 条件を満たす場合は true、それ以外は false
   * 関数の処理概要:
   *   1. 演算子が "-" であり、かつ left === right - result の関係が成立するか検証する。
   */
  function isReorderedEquation(left, operator, right, result) {
    return operator === "-" && left === right - result;
  }

  /**
   * マッチ棒を移動させて成立する正しい数式（解）を探索・抽出する
   * 入力パラメタ: 
   *   - left {number}: 初期状態の左辺の数値
   *   - operator {string}: 初期状態の演算子
   *   - right {number}: 初期状態の右辺の数値
   *   - result {number}: 初期状態の結果の数値
   * 出力値: 
   *   - {Array<string>}: 発見された正解の数式文字列のリスト
   * 関数の処理概要:
   *   1. 元の式のマッチ棒集合を取得する。
   *   2. 項入れ替え（isReorderedEquation）が可能な場合は解に追加する。
   *   3. 0〜MAX_NUMBERの数値・全演算子の組み合わせを総当たりループ処理する。
   *   4. 候補の式が数学的に正しいか、または特殊変形ルールを満たすか検証する。
   *   5. 元の式と候補の式で差分（取り除いた本数・追加した本数）を比較する。
   *   6. 移動本数が1本（または特殊変形で2本）の条件を満たす式を解答リストに追加して返す。
   */
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

  function findProblems(left, operator, right, result) {
    const target = matchsticksForExpression(left, operator, right, result);
    const problems = [];

    const numberOptions = (position, targetNumber) => {
      const targetSticks = new Set(
        [...matchsticksForNumber(targetNumber)].map(
          (stick) => `${position}:${stick}`,
        ),
      );
      return Array.from({ length: MAX_NUMBER + 1 }, (_, number) => number)
        .filter((number) => {
          const candidateSticks = new Set(
            [...matchsticksForNumber(number)].map(
              (stick) => `${position}:${stick}`,
            ),
          );
          const removedCount = [...targetSticks].filter(
            (stick) => !candidateSticks.has(stick),
          ).length;
          const addedCount = [...candidateSticks].filter(
            (stick) => !targetSticks.has(stick),
          ).length;
          return removedCount <= 2 && addedCount <= 2;
        });
    };

    const leftOptions = numberOptions("left", left);
    const rightOptions = numberOptions("right", right);
    const resultOptions = numberOptions("result", result);

    for (const problemLeft of leftOptions) {
      for (const problemRight of rightOptions) {
        for (const problemResult of resultOptions) {
          for (const problemOperator of Object.keys(OPERATORS)) {
            if (
              isCorrectEquation(
                problemLeft,
                problemOperator,
                problemRight,
                problemResult,
              )
            ) {
              continue;
            }

            const problem = matchsticksForExpression(
              problemLeft,
              problemOperator,
              problemRight,
              problemResult,
            );
            const removedCount = [...problem].filter(
              (stick) => !target.has(stick),
            ).length;
            const addedCount = [...target].filter(
              (stick) => !problem.has(stick),
            ).length;
            const oneMove = removedCount === 1 && addedCount === 1;
            const isSpecial = isTwoMoveSpecialTransformation(
              problemLeft,
              problemOperator,
              problemRight,
              problemResult,
              left,
              operator,
              right,
              result,
            );
            const twoMoves = removedCount === 2 && addedCount === 2;
            if (oneMove || (isSpecial && twoMoves)) {
              problems.push(
                `${problemLeft} ${problemOperator} ` +
                  `${problemRight} = ${problemResult}`,
              );
            }
          }
        }
      }
    }
    return problems;
  }

  /**
   * ユーザーが入力した数式文字列を解析し、検証する
   * 入力パラメタ: 
   *   - expression {string}: フォームに入力された数式文字列
   * 出力値: 
   *   - {Array<number|string>}: 解析済みの [left, operator, right, result] の配列
   * 関数の処理概要:
   *   1. 正規表現で "x [+-*] y = z" のフォーマットを満たしているか検証する（違反時は例外を投げる）。
   *   2. 各数値が MAX_NUMBER (99) 以下であるか確認する（違反時は例外を投げる）。
   *   3. 問題なければ数値・演算子を分解して配列として返す。
   */
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
    return [values[0], operator, values[1], values[2]];
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    output.classList.remove("error");
    answerVisual.replaceChildren();

    try {
      const [left, operator, right, result] = parseExpression(
        expressionInput.value,
      );
      const inputExpression = expressionInput.value.trim();
      if (isCorrectEquation(left, operator, right, result)) {
        const problems = findProblems(left, operator, right, result);
        if (problems.length) {
          renderExpressionProblem(problems, inputExpression);
        }
        output.textContent = problems.length
          ? `この式を解とする問題式:\n${problems.join("\n")}`
          : "この式を解とする問題式はありません。";
        return;
      }
      const solutions = findSolutions(left, operator, right, result);
      if (solutions.length) {
        renderExpressionAnswer(inputExpression, solutions);
      }
      output.textContent = solutions.length
        ? `解:\n${solutions.join("\n")}`
        : "1本のマッチ棒を移動して成立する式はありません。";
    } catch (error) {
      output.classList.add("error");
      output.textContent = `入力エラー: ${error.message}`;
    }
  });
})();
