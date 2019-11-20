# Welcome to diff-tables

This tool was created with the purpost of doing a diff between two MySQL databases (using specified tables) and then generating a .sql patch to fix the differences.

Please keep in mind that this program will generate a patch that affects the target tables so they are synced up as quick as possible, by keeping track of their primary keys. **IT WILL GENERATE DELETE AND UPDATE STATEMENTS** so please remember to review and clean up your .sql files before running them in production.

## Okay, but why?

Let's suppose you have a WordPress website that is updated on a daily basis, multiple times a day and it's backed up daily too. Somehow, a plugin managed to delete a few terms from your website and now it's a complete mess. You can't rollback the database without losing data, neither you can keep going with lots of your tags missing. This is the case that is included with the `config.sample.js` file and that also inspired the creation of this tool.

## Setting-up the environment

First, you will need to have a "source" and a "target" database. In the above case, the "source" is your current (production) database, and the "target" is your backup database. You will need to set them up in the `config.js` file. Take the sample file as your guide.

Now, you will need to set-up the structure of the tables you want to have fixed. This is a temporary step and will be removed in future iterations. You don't need to include the relationships either, they are not completely used, but may be used for consistency checks in the future. As long as you include the table name you should be fine.

Now, run the script. It will take a while since it will compare both tables and determine what needs to be inserted, deleted or updated.

Again, check the output files. Remove any statement you don't want to be executed (INSERT, DELETE and UPDATE are grouped). There should be one file per table.

Finally, run the SQL code.

## Author

This project is currently mantained by **Matheus "Matt" Pratta**, you can get in touch with me via my [GitHub profile](https://github.com/matheusmk3) or [website](https://matheus.io).

## License

This is free and unencumbered software released into the public domain under the "Unlicense" license. Please check the LICENSE file for more details.