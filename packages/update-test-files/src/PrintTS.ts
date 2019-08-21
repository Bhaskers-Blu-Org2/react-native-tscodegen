// tslint:disable:no-increment-decrement

import * as flow from 'minimum-flow-parser';

class Printer {
    private indentation: number = 0;
    private text: string = '';

    public pushIndent(): void {
        this.indentation++;
    }

    public popIndent(): void {
        this.indentation--;
    }

    public write(text: string): void {
        this.text += text;
    }

    public writeLn(): void {
        this.text += '\r\n';
    }

    public writeIndent(): void {
        for (let i = 0; i < this.indentation; i++) {
            this.write('  ');
        }
    }

    public toString(): string {
        return this.text;
    }
}

function printEntity(printer: Printer, entity: flow.EntityName): void {
    if (typeof entity === 'string') {
        printer.write(entity);
    } else {
        printEntity(printer, entity.parent);
        printer.write(entity.name);
    }
}

interface PrintTypeConfig {
    useReactNull: boolean;
}

function printUnionTypeWithHeader(printer: Printer, unionType: flow.UnionType, config: PrintTypeConfig): void {
    printer.pushIndent();
    for (const unionItem of unionType.elementTypes) {
        printer.writeLn();
        printer.writeIndent();
        printer.write('| ');
        printer.pushIndent();
        printType(printer, unionItem, config);
        printer.popIndent();
    }
    printer.popIndent();
}

function printType(printer: Printer, flowType: flow.Type, config: PrintTypeConfig): void {
    switch (flowType.kind) {
        case 'PrimitiveType': {
            printer.write(flowType.name);
            break;
        }
        case 'LiteralType': {
            printer.write(flowType.text);
            break;
        }
        case 'OptionalType': {
            if (config.useReactNull) {
                printer.write('(ReactNull | ');
            } else {
                printer.write('(undefined | ');
            }
            printType(printer, flowType.elementType, config);
            printer.write(')');
            break;
        }
        case 'ArrayType': {
            if (flowType.isReadonly) {
                printer.write('ReadonlyArray<');
                printType(printer, flowType.elementType, config);
                printer.write('>');
            } else {
                printType(printer, flowType.elementType, config);
                printer.write('[]');
            }
            break;
        }
        case 'ObjectType': {
            for (const mixinType of flowType.mixinTypes) {
                printType(printer, mixinType, config);
                printer.write(' & ');
            }
            printer.write('{');
            printer.writeLn();
            printer.pushIndent();
            for (const member of flowType.members) {
                switch (member.kind) {
                    case 'Prop': {
                        printer.writeIndent();
                        if (member.isReadonly) {
                            printer.write('readonly ');
                        }
                        printer.write(member.name);
                        if (member.isOptional) {
                            printer.write('?');
                        }
                        if (member.propType.kind === 'UnionType') {
                            printer.write(':');
                            printUnionTypeWithHeader(printer, member.propType, config);
                        } else {
                            printer.write(': ');
                            printType(printer, member.propType, config);
                        }
                        printer.write(';');
                        printer.writeLn();
                        break;
                    }
                    case 'Indexer': {
                        printer.writeIndent();
                        if (member.isReadonly) {
                            printer.write('readonly ');
                        }
                        printer.write('[');
                        printer.write(member.keyName);
                        printer.write(': ');
                        printType(printer, member.keyType, config);
                        printer.write(']: ');
                        printType(printer, member.valueType, config);
                        printer.write(';');
                        printer.writeLn();
                        break;
                    }
                    default: throw new Error(`Unrecognized Flow type: ${(<flow.ObjectMember>member).kind}`);
                }
            }
            printer.popIndent();
            printer.writeIndent();
            printer.write('}');
            break;
        }
        case 'DecoratedGenericType': {
            printer.write('Readonly<');
            printType(printer, flowType.elementType, config);
            printer.write('>');
            break;
        }
        case 'UnionType': {
            for (let i = 0; i < flowType.elementTypes.length; i++) {
                if (i !== 0) {
                    printer.write(' | ');
                }
                printType(printer, flowType.elementTypes[i], config);
            }
            break;
        }
        case 'TypeReference': {
            printEntity(printer, flowType.name);
            if (flowType.typeArguments.length > 0) {
                printer.write('<');
                for (let i = 0; i < flowType.typeArguments.length; i++) {
                    if (i !== 0) {
                        printer.write(', ');
                    }
                    printType(printer, flowType.typeArguments[i], config);
                }
                printer.write('>');
            }
            break;
        }
        case 'ParenType': {
            printer.write('(');
            printType(printer, flowType.elementType, config);
            printer.write(')');
            break;
        }
        default: throw new Error(`Unrecognized Flow type: ${(<flow.Type>flowType).kind}`);
    }
}

function printStatement(printer: Printer, stat: flow.Statement, forceExport: boolean, typeConfig: PrintTypeConfig): void {
    switch (stat.kind) {
        case 'UseStrictStat': {
            printer.write(`'use strict';`); break;
        }
        case 'TypeAliasDecl': {
            if (forceExport || stat.hasExport) {
                printer.write(`export `);
            }
            printer.write(`type ${stat.name} =`);
            if (stat.aliasedType.kind === 'UnionType') {
                printUnionTypeWithHeader(printer, stat.aliasedType, typeConfig);
                printer.write(';');
            } else {
                printer.write(' ');
                printType(printer, stat.aliasedType, typeConfig);
                printer.write(';');
            }
            break;
        }
        default: throw new Error(`Unrecognized Flow type: ${(<flow.Statement>stat).kind}`);
    }
}

export function printTypeScript(program: flow.FlowProgram, forceExport: boolean, typeConfig: PrintTypeConfig): string {
    const printer = new Printer();
    for (const stat of program.statements) {
        printStatement(printer, stat, forceExport, typeConfig);
        printer.writeLn();
        printer.writeLn();
    }
    return printer.toString();
}