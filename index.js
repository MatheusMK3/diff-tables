(async () => {
  const fs = require('fs')
  const mysql = require('mysql')
  const utils = require('./utils')

  // Load settings from config file
  console.info('Loading configuration...')

  const config = require('./config')
  const sourceConnection = mysql.createConnection(config.source)
  const targetConnection = mysql.createConnection(config.target)

  console.info('Connecting to databases...')

  try {
    // Attempts to connect to source database
    await sourceConnection.connect()
  } catch (sourceConnectionError) {
    // Throw errors
    return console.error('Could not connect to source database:', sourceConnectionError)
  }

  try {
    // Attempts to connect to target database
    await targetConnection.connect()
  } catch (targetConnectionError) {
    // Close source connection and throw error
    sourceConnection.end()
    return console.error('Could not connect to target database:', targetConnectionError)
  }

  // We're connected!
  console.info('Connected to databases!')

  // Creates a relationship tree based on entry point
  console.info('Generating relationship tree...')

  let relationships = utils.makeRelationshipTree(config.entry, config.tables)
  if (!relationships) return console.error('Invalid relationship tree source. Did you included both entry and tables definitions on configs?')

  // Extracts data tree
  console.info('Generating data trees...')

  let sourceData = await utils.makeDataTree(config.tables, sourceConnection)
  let targetData = await utils.makeDataTree(config.tables, targetConnection)

  console.info('Data and relationship trees generated!')

  // Runs comparisons
  console.info('Preparing comparisons...')

  let comparisonData = utils.compareDataTrees(sourceData, targetData, relationships)

  // Process comparisons
  console.info('Comparison finished. Generating SQL file...')
  
  let finalSQL = utils.makeSqlFromComparison(comparisonData, sourceData, targetData)

  // Write SQL
  console.info('Writing files...')

  // Loop through each table, getting the SQL and writing its file
  for (let table in finalSQL) {
    let commands = finalSQL[table]
    fs.writeFileSync(`diff-tables-output-${table}.sql`, commands.join('\r\n'))
  }

  // Done
  console.info('Done :)')
  process.exit(0)
})()