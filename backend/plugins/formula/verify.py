import re
from dataclasses import dataclass, field


@dataclass
class FormulaVerification:
    expression: str
    is_valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


def verify_formula(expression: str, domain: str = "real") -> FormulaVerification:
    errors: list[str] = []
    warnings: list[str] = []
    suggestions: list[str] = []

    paren_count = 0
    for ch in expression:
        if ch in "([{":
            paren_count += 1
        elif ch in ")]}":
            paren_count -= 1
        if paren_count < 0:
            errors.append("括号不匹配")
            break
    if paren_count > 0:
        errors.append("括号不匹配")
    if paren_count == 0 and not errors:
        suggestions.append("括号匹配正确")

    if re.search(r"/\s*0\b", expression):
        errors.append("除零错误")

    if domain == "real":
        neg_sqrt = re.findall(r"sqrt\s*\(\s*-", expression)
        if neg_sqrt:
            warnings.append("实数域下 sqrt 参数可能为负，请确认定义域")

    if "\\" in expression:
        suggestions.append("检测到 LaTeX 命令，将转换为 SymPy 可解析格式")

    is_valid = len(errors) == 0
    return FormulaVerification(
        expression=expression,
        is_valid=is_valid,
        errors=errors,
        warnings=warnings,
        suggestions=suggestions,
    )


def latex_to_sympy(latex_str: str) -> str:
    """Convert LaTeX string to a SymPy-compatible expression string.

    Uses sympy.parsing.latex.parse_latex when available (sympy >= 1.6),
    falling back to a regex-based approach for broader LaTeX construct support.
    """
    # Attempt 1: Use sympy.parsing.latex.parse_latex (sympy >= 1.6)
    try:
        from sympy import sstr
        from sympy.parsing.latex import parse_latex
        expr = parse_latex(latex_str)
        return sstr(expr)
    except Exception:
        import logging
        logging.getLogger(__name__).debug(
            "sympy.parsing.latex failed for input, falling back to regex"
        )

    # Attempt 2: Regex-based fallback
    s = latex_str.strip()

    # Handle \frac{a}{b} -> (a)/(b)
    s = re.sub(r'\\frac\{([^}]*)\}\{([^}]*)\}', r'(\1)/(\2)', s)
    # Handle \sqrt[n]{x} and \sqrt{x}
    s = re.sub(r'\\sqrt(?:\[([^}]*)\])?\{([^}]*)\}', r'sqrt(\2)', s)
    # Handle common Greek / LaTeX commands
    s = re.sub(r'\\alpha', 'alpha', s)
    s = re.sub(r'\\beta', 'beta', s)
    s = re.sub(r'\\theta', 'theta', s)
    s = re.sub(r'\\pi', 'pi', s)
    s = re.sub(r'\\infty', 'oo', s)
    s = re.sub(r'\\cdot', '*', s)
    s = re.sub(r'\\times', '*', s)
    s = re.sub(r'\\sum', 'Sum', s)
    s = re.sub(r'\\int', 'Integral', s)
    s = re.sub(r'\\partial', 'partial', s)
    s = re.sub(r'\\sin', 'sin', s)
    s = re.sub(r'\\cos', 'cos', s)
    s = re.sub(r'\\tan', 'tan', s)
    s = re.sub(r'\\log', 'log', s)
    s = re.sub(r'\\ln', 'ln', s)
    s = re.sub(r'\\exp', 'exp', s)
    s = re.sub(r'\\lim', 'Limit', s)
    s = re.sub(r'\\mathrm\{([^}]*)\}', r'\1', s)
    s = re.sub(r'\\text\{([^}]*)\}', r'\1', s)
    # Handle superscripts ^ and subscripts _
    s = re.sub(r'\^\{([^}]*)\}', r'**(\1)', s)
    s = re.sub(r'\^([a-zA-Z0-9])', r'**\1', s)
    s = re.sub(r'_\{([^}]*)\}', r'_\1', s)
    s = re.sub(r'_([a-zA-Z0-9])', r'_\1', s)
    # Clean up remaining braces -> parentheses
    s = s.replace('{', '(').replace('}', ')')
    return s


def sympy_verify(latex_str: str) -> FormulaVerification:
    errors: list[str] = []
    suggestions: list[str] = []

    try:
        from sympy.parsing.sympy_parser import (
            convert_xor,
            implicit_multiplication_application,
            parse_expr,
            standard_transformations,
        )
        python_expr = latex_to_sympy(latex_str)
        transformations = standard_transformations + (
            implicit_multiplication_application, convert_xor
        )
        sympy_parsed = parse_expr(
            python_expr,
            transformations=transformations,
            evaluate=False,
        )
        suggestions.append(f"SymPy 解析成功: {sympy_parsed}")
    except Exception as e:
        errors.append(f"SymPy 解析失败: {str(e)[:100]}")
        return FormulaVerification(expression=latex_str, is_valid=False, errors=errors)

    symbols = list(sympy_parsed.free_symbols) if hasattr(sympy_parsed, 'free_symbols') else []
    if symbols:
        suggestions.append(f"检测到符号: {', '.join(str(s) for s in symbols)}")

    is_valid = len(errors) == 0
    return FormulaVerification(
        expression=latex_str,
        is_valid=is_valid,
        errors=errors,
        warnings=[],
        suggestions=suggestions,
    )
