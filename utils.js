const util = require('util')
const _ = require('lodash')

module.exports = {
  makeRelationshipTree (entry, tables, isRecursing) {
    // Returns false (invalid) if no entry or tables is passed
    if (!entry || !tables) return false

    // Creates the tree
    let tree = []

    // Gets the table definition
    let table = tables[entry]
    
    if (!isRecursing)
      console.info(`Generating definition tree for table ${entry}...`)

    // Gets the table foreign keys
    for (let foreignKey in (table.foreign || {})) {
      // Gets the key definition
      let foreignKeyDefinition = table.foreign[foreignKey]

      console.info(`Mapping key ${entry}.${foreignKey} => ${foreignKeyDefinition.table}.${foreignKeyDefinition.references}`)

      // Recurses
      let foreignKeyDefinitionTree = this.makeRelationshipTree(foreignKeyDefinition.table, tables, true)

      // Update tree definition
      tree = [...tree, [`${foreignKeyDefinition.table}.${foreignKeyDefinition.references}`, `${entry}.${foreignKey}`], ...foreignKeyDefinitionTree]
    }

    // Returns the tree
    return tree
  },

  async makeDataTree (tables, connection) {
    // Promisify the query function
    const query = util.promisify(connection.query).bind(connection)

    // Creates the tree
    let tree = {}

    // Gets every table contents
    for (let tableName in tables) {
      // We create the table definition
      tree[tableName] = {
        keyBy: [],
        keyByIndex: [],
        columns: [],
        data: {},
      }

      // Get the table column names and primary keys
      let tableColumns = await query(`SHOW COLUMNS FROM ${tableName}`)

      // Process the table columns
      for (let iColumn in tableColumns) {
        // Get the column
        let column = tableColumns[iColumn]

        // The column name
        tree[tableName].columns.push(column.Field)

        // Check for primary key
        if (column.Key == 'PRI') {
          tree[tableName].keyBy.push(column.Field)
          tree[tableName].keyByIndex.push(iColumn)
        }
      }

      // Get the table values
      let tableValues = await query(`SELECT * FROM ${tableName}`)

      // Process the table values
      for (let iValue in tableValues) {
        // Get the row
        let row = Object.values(tableValues[iValue])

        // Adds to data by key
        tree[tableName].data[this.makeRowKeyString(row, tree[tableName])] = row
      }
    }

    // Returns the tree
    return tree
  },

  makeRowKeyString (row, table) {
    return table.keyByIndex.map(key => row[key]).join(',')
  },

  compareTableDataTrees (source, target, relationshipTree) {
      // The result 
      let results = {
        insert: [],
        update: [],
        delete: [],
        equals: [],
        totals: [],
      }

      // Compares both tables, detecting what has been inserted, updated, deleted or equals
      for (let rowKeyString in source.data) {
        // Register this row key-string into the totals
        results.totals.push(rowKeyString)

        // Gets current (source) data row
        let sourceData = source.data[rowKeyString]

        // Tries to get the new (target) data row
        let targetData = target.data[rowKeyString]

        // Does the target row was found? If not, it was deleted
        if (!targetData) {
          // Save into 'delete' state and continue
          results.delete.push(rowKeyString)
          continue
        }

        // Does the target row matches the old row?
        if (_.isEqual(sourceData, targetData)) {
          // If so, add it to 'equals'
          results.equals.push(rowKeyString)
        } else {
          // If not, add it to 'update'
          results.update.push(rowKeyString)
        }
      }

      // Now we check the target table for missing entries
      for (let rowKeyString in target.data) {
        // Did this key was processed before?
        if (~results.totals.indexOf(rowKeyString)) {
          // Then we're fine
          continue
        } else {
          // The row is new, add it to 'insert'
          results.insert.push(rowKeyString)
        }
      }

      // Done
      return results
  },

  compareDataTrees (source, target, relationshipTree) {
    // This will contain our results
    let results = {}

    for (let table in source) {
      // Check if target also has same table
      if (!target[table]) continue

      // Runs test
      console.info(`Running comparison of table ${table}...`)

      results[table] = this.compareTableDataTrees(source[table], target[table], relationshipTree)
    }

    // Done
    return results
  },

  makeSqlFromComparison (comparisonData, sourceDataTree, targetDataTree) {
    // Our tables output
    let tables = {}

    // Loop through the tables in comparison
    for (let table in comparisonData) {
      // Get the table diff
      let tableDiff = comparisonData[table]

      // Create a variable to hold our commands
      let tableCmds = []

      // Handle the DELETE commands first
      tableCmds.push('--------------------------')
      tableCmds.push('-- BEGIN: DELETE commands')
      tableCmds.push('--------------------------')
      for (let iKeyString in tableDiff.delete) {
        let rowKeyString = tableDiff.delete[iKeyString]
        tableCmds.push(`DELETE FROM ${this.makeSafeStringWrap(table, '`')} WHERE ${this.makeKeyByWhereStatement(rowKeyString, sourceDataTree[table])};`)
      }
      tableCmds.push('--------------------------')
      tableCmds.push('-- END: DELETE commands')
      tableCmds.push('--------------------------')

      tableCmds.push('')

      // Then the UPDATE commands
      tableCmds.push('--------------------------')
      tableCmds.push('-- BEGIN: UPDATE commands')
      tableCmds.push('--------------------------')
      for (let iKeyString in tableDiff.update) {
        let rowKeyString = tableDiff.update[iKeyString]
        let rowData = targetDataTree[table].data[rowKeyString]
        let rowSet = rowData.map((data, i) => {
          let field = this.makeSafeStringWrap(targetDataTree[table].columns[i], '`')
          let value = this.makeSafeValueWrap(data)
          return `${field}=${value}`
        })
        tableCmds.push(`UPDATE ${this.makeSafeStringWrap(table, '`')} SET ${rowSet.join(',')} WHERE ${this.makeKeyByWhereStatement(rowKeyString, sourceDataTree[table])};`)
      }
      tableCmds.push('--------------------------')
      tableCmds.push('-- END: UPDATE commands')
      tableCmds.push('--------------------------')

      tableCmds.push('')

      // Then the INSERT commands
      tableCmds.push('--------------------------')
      tableCmds.push('-- BEGIN: INSERT commands')
      tableCmds.push('--------------------------')
      for (let iKeyString in tableDiff.insert) {
        let rowKeyString = tableDiff.insert[iKeyString]
        let rowData = targetDataTree[table].data[rowKeyString]
        let rowColumns = targetDataTree[table].columns.map(field => this.makeSafeStringWrap(field, '`'))
        let rowValues = rowData.map(field => this.makeSafeValueWrap(field))
        tableCmds.push(`INSERT INTO ${this.makeSafeStringWrap(table, '`')} (${rowColumns.join(',')}) VALUES (${rowValues.join(',')});`)
      }
      tableCmds.push('--------------------------')
      tableCmds.push('-- END: INSERT commands')
      tableCmds.push('--------------------------')

      // Save the table commands
      tables[table] = tableCmds
    }

    // Done
    return tables
  },

  makeKeyByWhereStatement (rowKeyString, table) {
    // Gets the row values
    let values = table.data[rowKeyString]

    // Combines both keyBy and the values into tuples
    let keyByValues = table.keyBy.map(key => [key, values[table.keyByIndex[table.keyBy.indexOf(key)]]])

    // Generates the statement for each pair
    let statements = keyByValues.map(tuple => {
      // Extract field and value
      let field = tuple[0]
      let value = this.makeSafeValueWrap(tuple[1])

      // Return the WHERE statement data
      return `\`${field}\`=${value}`
    })

    // Returns the WHERE statement content
    return statements.join(' AND ')
  },

  makeSafeValueWrap(value, wrap) {
    // If no wrapper, use "
    if (!wrap) wrap = '\''

    // Test possible types of the value
    if (null == value) value = 'NULL'
    else if ('string' == typeof value) value = this.makeSafeStringWrap(value, wrap)

    return value
  },

  makeSafeStringWrap (string, wrap) {
    // If no wrapper, use "
    if (!wrap) wrap = '\''

    // Do it's thing
    return `${wrap}${this.makeSafeString(string, wrap)}${wrap}`
  },

  makeSafeString (string, separator) {
    // If no separator, use "
    if (!separator) separator = '\''
    
    // Do it's thing
    return string.replace(`${separator}`, `\\${separator}`)
  },
}