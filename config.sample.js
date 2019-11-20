module.exports = {
  // The entry point of our relationship tree
  entry: 'wp_term_relationships',
  
  // Here we define our tables relations
  tables: {
    wp_terms: {
      unique: ['slug'],
    },
    wp_term_taxonomy: {
      foreign: {
        term_id: {
          references: 'term_id',
          table: 'wp_terms',
        }
      },
    },
    wp_term_relationships: {
      foreign: {
        term_taxonomy_id: {
          references: 'term_taxonomy_id',
          table: 'wp_term_taxonomy',
        },
      },
    },
  },

  // The source database, this is the one with information "missing"
  source: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'database_with_deleted_terms',
  },

  // The target database, this is the one with up-to-date information
  target: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'old_backup_with_terms',
  },
}