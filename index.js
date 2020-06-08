const { readFileSync } = require('fs');
const { green, red, bold } = require('chalk');

const file = readFileSync('./example.js', 'utf8');


let inComment = false;
let isBlock = false;
let isTease = false;
let inTease = false;
let isFunction = false;
let inFunction = false;
let inArgs = false;
let inBody = false;
let inString = false;
let bodyLevel = 0;
let isInput = true;
let stringTerminator;
let inputExpressions = [];
let expectedExpressions = [];
let tests = [];
let units = [];
let expression = '';
let maybeTease = false;
let maybeFunction = false;
let isAsync = false;
let isEscaping = false;
let fnName = '';
let fnBody = '';
let argsList = [];
let argLevel = 0;

function initialize() {
  inComment = false;
  isBlock = false;
  isTease = false;
  inTease = false;
  isFunction = false;
  inFunction = false;
  inArgs = false;
  inBody = false;
  inString = false;
  bodyLevel = 0;
  isInput = true;
  stringTerminator = '';
  inputExpressions = [];
  expectedExpressions = [];
  tests = [];
  expression = '';
  maybeTease = false;
  maybeFunction = false;
  isAsync = false;
  isEscaping = false;
  fnName = '';
  fnBody = '';
  argsList = [];
  argLevel = 0;
}

for (let i = 0; i < file.length; i++) {
  let char = file[i];
  let charCode = char.charCodeAt(0);


  if (isTease) {
    if (!inFunction) {
      if (maybeFunction) {
        if (charCode === 32) {
          if (!isAsync && expression === 'async') {
            isAsync = true;
            expression = '';
            continue;
          }
          if (expression === 'function') {
            inFunction = true;
            expression = '';
            maybeFunction = false;
            continue;
          }
          maybeFunction = false;
          continue;
        }
        expression += char;

      } else {
        if (/[a|f]/.test(char)) {
          maybeFunction = true;
          expression += char;
        }
      }
    } else {
      // console.log(charCode, '::', char);
      if (inArgs) {
        switch (charCode) {
          case 40: // (
            argLevel++;
            continue;
          case 41: // )
            argLevel--;
            if (!argLevel) {
              inArgs = false;
              inBody = true;
              // bodyLevel = 1;
              if (expression) {
                argsList.push(expression);
                expression = '';
              }
            }
            continue;
          case 44: // ','
            if (expression) {
              argsList.push(expression);
            }
            expression = '';
            continue;
          default:
            if (charCode !== 32) {
              expression += char;
            }
        }
      } else if (inBody) {
        if (inString) {
          if (stringTerminator) {
            inString = false;
          }
          expression += char;
        } else {
          switch (charCode) {
            case 123:
              bodyLevel++;
              continue;
            case 125:
              bodyLevel--;
              if (bodyLevel === 0) {
                inBody = false;
                fnBody = expression;
                units.push({
                  fnName,
                  isAsync,
                  argsList,
                  fnBody,
                  tests
                });
                initialize();
              }
              continue;
            default:
              // console.table({ charCode, char });
              if (charCode !== 10) {
                if (charCode === 32 && !expression) {
                  continue;
                }
                expression += char;
              }
              if ([ 34, 39 ].includes(charCode)) {
                inString = true;
                stringTerminator = char;
              }
          }
        }
      } else {
        if (charCode === 40) {
          inArgs = true;
          argLevel = 1;
          expression = '';
          continue;
        }
        fnName += char;
      }
    }
  } else {
    if (inComment) {
      if (charCode === 64) {
        maybeTease = true;
        continue;
      }
      if (maybeTease) {
        expression += char;
        if ([ 10, 32 ].includes(charCode)) {
          if (/t(?:ease)?\s/.test(expression)) {
            inTease = true;
          }
          expression = '';
          maybeTease = false;
          continue;
        }
      }
      if (isBlock) {
        if (inTease) {
          if (isInput) {
            // terminate block comment
            if (charCode === 42 && file[i + 1].charCodeAt(0) === 47) {
              if (inTease) {
                inTease = false;
                isTease = true;
              }
              inComment = false;
              isBlock = false;
              continue;
            }

            if ([ 32, 45 ].includes(charCode)) {
              if (expression) {
                inputExpressions.push(expression);
              }
              expression = '';
              if (file[i + 1].charCodeAt(0) === 62) {
                isInput = false;
                i += 1;
              }
              continue;
            }
            expression += char;
          } else {
            switch (charCode) {
              case 10:
              case 32:
                if (expression) {
                  expectedExpressions.push(expression);
                }
                if (charCode === 10) {
                  if (inputExpressions.length && expectedExpressions.length) {
                    tests.push({
                      inputs: inputExpressions,
                      expected: expectedExpressions
                    });
                  }
                  inputExpressions = [];
                  expectedExpressions = [];
                  expression = '';
                  isInput = true;
                  continue;
                }
                expression = '';
                continue;
              default:
                expression += char;
            }
          }
        }
      } else {
        if (inTease) {
          if (isInput) {
            if ([ 32, 45 ].includes(charCode)) {
              if (expression) {
                inputExpressions.push(expression);
              }
              expression = '';
              if (file[i + 1].charCodeAt(0) === 62) {
                isInput = false;
                i += 1;
              }
              continue;
            }
            expression += char;
          } else {
            if ([ 10, 32 ].includes(charCode)) {
              if (expression) {
                expectedExpressions.push(expression);
              }
              expression = '';
              if (charCode === 10) {
                inTease = false;
                if (inputExpressions.length && expectedExpressions.length) {
                  isTease = true;
                  tests.push({
                    inputs: inputExpressions,
                    expected: expectedExpressions
                  });
                }
              }
              continue;
            }
            expression += char;
          }
        }
        // terminate line comment
        if (charCode === 10) {
          if (inTease) {
            inTease = false;
            isTease = true;
          }
          inComment = false;
        }
      }
    } else {
      if (charCode === 47) {
        let nextChar = file[i + 1].charCodeAt(0);
        if ([ 42, 47 ].includes(nextChar)) {
          inComment = true;
          if (nextChar === 42) {
            isBlock = true;
          }
        }
      }
    }
  }
}

units.forEach(unit => {
  let func = new Function(unit.argsList, unit.fnBody);
  for (let i = 0; i < unit.tests.length; i++) {
    let { inputs, expected } = unit.tests[i];
    [ expected ] = expected;
    try {
      expected = +expected;
    } catch (e) {
    }

    let log = bold(unit.fnName);
    let result = func(...inputs);
    let success = result === expected;
    if (success) {
      log = green(log + ' passed!');
    } else {
      log = red(log + ' failed.') + ' expected: ' + expected + '; inputs: ' + inputs + ', got: ' + result;
    }
    console.log(log);
  }
});
