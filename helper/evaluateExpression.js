function evaluateExpression(operator, left, right) {
  switch (operator) {
    case '==':
    case 'equal':
      return left == right;
    case '===':
      return left === right;
    case '!=':
      return left != right;
    case '!==':
      return left !== right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '&&':
      return left && right;
    case '||':
      return left || right;
    case '??':
      return left ?? right;
    case 'regex':
      return new RegExp(right).test(left);
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

export default evaluateExpression;
