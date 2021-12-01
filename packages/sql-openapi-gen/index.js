#!/usr/bin/env node

const fs = require("fs");
const { camelCase } = require("change-case");
const { Parser } = require("sql-ddl-to-json-schema");

const DECIMAL_AS_STRING = true;

const yargs = require("yargs")
  .help()
  .usage("$0 <db> [table]", "Generate jsona openapi from sql file")
  .positional("db", {
    description: "db file",
  })
  .positional("table", {
    description: "generate for specific sql table",
  });

if (require.main === module) {
  const argv = yargs.parse(process.argv.slice(2));
  run(argv);
} else {
  module.exports = { yargs, run };
}

function run({ db, table }) {
  const content = fs.readFileSync(db, "utf8");
  const parser = new Parser("mysql");
  const tables = parser.feed(content).toCompactJson();
  let selectTables = [];
  if (table) {
    const foundTable = tables.find((v) => v.name === table);
    if (!foundTable) exit(`No table ${table} exist in ${db}`);
    selectTables.push(table);
  } else {
    selectTables = tables.map((v) => v.name);
  }
  for (const tableName of selectTables) {
    const foundTable = tables.find((v) => v.name === tableName);
    const model = pruneTable(foundTable);
    console.log(generate(model, tableName));
  }
}

function generate(model, tableName) {
  const idColumn =
    model.columns.find((v) => v.primaryKey === true) || model.columns[0];
  const tableNameCamel = camelCase(tableName);
  return `  list${tableName}s: { @endpoint({summary:"list ${tableNameCamel} records"})
    route: "GET /${tableNameCamel}s",
    req: {
      query: {}
    },
    res: {
      200: {
        count: 10,
        rows: [
          { @save("${tableName}")${listFields(model.columns)}
          }
        ]
      }
    }
  },
  create${tableName}: { @endpoint({summary:"create ${tableNameCamel}"})
    route: "POST /${tableNameCamel}",
    req: {
      body: {${createFields(model.columns)}
      }
    },
    res: {
      200: { @use("${tableName}")
      }
    }
  },
  get${tableName}: { @endpoint({summary:"get ${tableNameCamel} info"})
    route: "GET /${tableNameCamel}/{}",
    req: {
      params: {
        ${idColumn.colName}: ${getFieldValue(idColumn)},
      },
    },
    res: {
      200: { @use("${tableName}")
      }
    }
  },
  update${tableName}: { @endpoint({summary:"update ${tableNameCamel}"})
    route: "PUT /${tableNameCamel}/{}",
    req: {
      params: {
        ${idColumn.colName}: ${getFieldValue(idColumn)},
      },
      body: {${updateFields(model.columns)}
      }
    },
    res: {
      200: {
        msg: "OK"
      }
    }
  },
  delete${tableName}: { @endpoint({summary:"delete ${tableNameCamel}"})
    route: "DELETE /${tableNameCamel}/{}",
    req: {
      params: {
        ${idColumn.colName}: ${getFieldValue(idColumn)},
      },
    },
    res: {
      200: {
        msg: "OK"
      }
    }
  },
`;
}

function listFields(columns) {
  const spaces = " ".repeat(12);
  let output = "";
  for (const col of columns) {
    output += `\n${spaces}${col.colName}: ${getFieldValue(col)},`;
    if (col.comment) {
      output += ` @description("${col.comment}")`;
    }
  }
  return output;
}

function createFields(columns) {
  const spaces = " ".repeat(8);
  let output = "";

  for (const col of columns) {
    if (col.colName === "id" && col.autoIncrement) {
      continue;
    }
    if (typeof col.defaultValue !== "undefined") {
      continue;
    }
    output += `\n${spaces}${col.colName}: ${getFieldValue(col)},`;
    const nonNull = !col.allowNull && typeof col.defaultValue === "undefined";
    if (!nonNull) {
      output += " @optional";
    }
    if (col.comment) {
      output += ` @description("${col.comment}")`;
    }
  }
  return output;
}

function updateFields(columns) {
  const spaces = " ".repeat(8);
  let output = "";

  for (const col of columns) {
    if (col.colName === "id" && col.autoIncrement) {
      continue;
    }
    if (col.colName === "createdAt" && col.defaultValue === "NOW") {
      continue;
    }
    output += `\n${spaces}${col.colName}: ${getFieldValue(col)}, @optional`;
  }
  return output;
}

function getFieldValue(column) {
  if (typeof column.defaultValue !== "undefined") {
    if (column.defaultValue === "NOW") {
      return '"<datetime>"';
    }
    return column.defaultValue;
  }
  switch (column.valueType) {
    case "number":
      return 1;
    case "string":
      return '""';
    case "bool":
      return false;
    case "Date":
      return '"<datetime>"';
    default:
      return '""';
  }
}

function exit(msg, exitCode = 1) {
  console.log(msg);
  process.exit(exitCode);
}

function pruneTable(table) {
  const name = table.name;
  const columns = table.columns.map((col) => {
    const { valueType } = getType(col.type, col.options.unsigned);
    let defaultValue;
    if (typeof col.options.default !== "undefined") {
      if (col.options.default === "CURRENT_TIMESTAMP") {
        defaultValue = "NOW";
      } else {
        defaultValue = col.options.default;
      }
    }
    return {
      colName: col.name,
      valueType,
      comment: col.options.comment,
      allowNull: col.options.nullable,
      autoIncrement: !!col.options.autoincrement,
      defaultValue,
      primaryKey: !!table.primaryKey.columns.find((v) => v.column === col.name),
    };
  });
  return { name, columns };
}

function getType(type, unsigned) {
  if (type.datatype === "int") {
    const suffix = unsigned ? ".UNSIGNED" : "";
    const valueType = "number";
    if (type.width === 1) {
      const sequelizeType = `TINYINT()${suffix}`;
      return { sequelizeType, valueType };
    } else if (type.width === 8) {
      const sequelizeType = `BIGINT()${suffix}`;
      return { sequelizeType, valueType };
    } else {
      const sequelizeType = `INTEGER()${suffix}`;
      return { sequelizeType, valueType };
    }
  } else if (type.datatype === "decimal") {
    const suffix = unsigned ? ".UNSIGNED" : "";
    const valueType = DECIMAL_AS_STRING ? "string" : "number";
    const sequelizeType = `DECIMAL(${type.digits},${type.decimals})${suffix}`;
    return { sequelizeType, valueType };
  } else if (type.datatype === "float") {
    const suffix = unsigned ? ".UNSIGNED" : "";
    const valueType = "number";
    const sequelizeType = `FLOAT()${suffix}`;
    return { valueType, sequelizeType };
  } else if (type.datatype === "double") {
    const suffix = unsigned ? ".UNSIGNED" : "";
    const valueType = "number";
    const sequelizeType = `DOUBLE()${suffix}`;
    return { valueType, sequelizeType };
  } else if (type.datatype === "char") {
    const valueType = "string";
    const sequelizeType = `CHAR(${type.length})`;
    return { valueType, sequelizeType };
  } else if (type.datatype === "varchar") {
    const valueType = "string";
    const sequelizeType = `STRING(${type.length})`;
    return { valueType, sequelizeType };
  } else if (type.datatype === "text") {
    const valueType = "string";
    const sequelizeType = "TEXT()";
    return { valueType, sequelizeType };
  } else if (type.datatype === "datetime") {
    const valueType = "Date";
    const sequelizeType = "DATE()";
    return { valueType, sequelizeType };
  } else if (type.datatype === "date") {
    const valueType = "Date";
    const sequelizeType = "DATEONLY()";
    return { valueType, sequelizeType };
  } else if (type.datatype === "timestamp") {
    const valueType = "Date";
    const sequelizeType = "DATE()";
    return { valueType, sequelizeType };
  } else if (type.datatype === "json") {
    const valueType = "any";
    const sequelizeType = "JSON";
    return { valueType, sequelizeType };
  }
}
