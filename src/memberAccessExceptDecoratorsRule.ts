import * as Lint from 'tslint';
import * as ts from 'typescript';
import {
  getChildOfKind,
  getModifier,
  getTokenAtPosition,
  hasModifier,
  isClassLikeDeclaration
} from 'tsutils';

export class Rule extends Lint.Rules.AbstractRule {
  public static metadata: Lint.IRuleMetadata = {
    ruleName: 'member-access-except-decorators',
    description: 'Requires explicit visibility declarations for class members except members with decorators.',
    optionsDescription: 'No options yet',
    options: null,
    type: 'typescript',
    typescriptOnly: true,
    hasFix: true
  };

  public static FAILURE_STRING_FACTORY(
    memberType: string,
    memberName: string | undefined,
  ): string {
    memberName = memberName === undefined ? '' : ` '${memberName}'`;

    return `The ${memberType}${memberName} must be marked either 'private', 'public', or 'protected'`;
  }

  public apply(sourceFile: ts.SourceFile): Array<Lint.RuleFailure> {
    return this.applyWithFunction(sourceFile, walk);
  }
}

function walk(ctx: Lint.WalkContext<void>): any {
  return ts.forEachChild(ctx.sourceFile, function recur(node: ts.Node): void {
    if (isClassLikeDeclaration(node)) {
      for (const child of node.members) {
        if (shouldCheck(child)) {
          check(child);
        }
      }
    }

    return ts.forEachChild(node, recur);
  });

  function shouldCheck(node: ts.ClassElement): boolean {
    switch (node.kind) {
      case ts.SyntaxKind.GetAccessor:
      case ts.SyntaxKind.SetAccessor:
      case ts.SyntaxKind.MethodDeclaration:
        return true;
      case ts.SyntaxKind.PropertyDeclaration:
        return !node.decorators;
      default:
        return false;
    }
  }

  function check(node: ts.ClassElement | ts.ParameterDeclaration): void {
    if (
      hasModifier(
        node.modifiers,
        ts.SyntaxKind.ProtectedKeyword,
        ts.SyntaxKind.PrivateKeyword,
      )
    ) {
      return;
    }

    const publicKeyword = getModifier(node, ts.SyntaxKind.PublicKeyword);
    if (publicKeyword === undefined) {
      const nameNode =
        node.kind === ts.SyntaxKind.Constructor
          // tslint:disable-next-line: no-non-null-assertion
          ? getChildOfKind(node, ts.SyntaxKind.ConstructorKeyword, ctx.sourceFile)!
          : node.name !== undefined
            ? node.name
            : node;
      const memberName =
        node.name !== undefined && node.name.kind === ts.SyntaxKind.Identifier
          ? node.name.text
          : undefined;
      ctx.addFailureAtNode(
        nameNode,
        Rule.FAILURE_STRING_FACTORY(typeToString(node), memberName),
        Lint.Replacement.appendText(getInsertionPosition(node, ctx.sourceFile), 'public '),
      );
    }
  }

  function getInsertionPosition(
    member: ts.ClassElement | ts.ParameterDeclaration,
    sourceFile: ts.SourceFile,
  ): number {
    const node =
      member.decorators === undefined
        ? member
        // tslint:disable-next-line: no-non-null-assertion
        : getTokenAtPosition(member, member.decorators.end, sourceFile)!;

    return node.getStart(sourceFile);
  }

  function typeToString(node: ts.ClassElement | ts.ParameterDeclaration): string {
    switch (node.kind) {
      case ts.SyntaxKind.MethodDeclaration:
        return 'class method';
      case ts.SyntaxKind.PropertyDeclaration:
        return 'class property';
      case ts.SyntaxKind.GetAccessor:
        return 'get property accessor';
      case ts.SyntaxKind.SetAccessor:
        return 'set property accessor';
      case ts.SyntaxKind.Parameter:
        return 'parameter property';
      default:
        throw new Error(`unhandled node type ${ts.SyntaxKind[node.kind]}`);
    }
  }
}
