const { Client } = require('@notionhq/client');

const notion = new Client({ auth: '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' });
const STUDENT_DATABASE_ID = '1abd37d666308071bfe1e37d1d155035';

async function checkStudents() {
  try {
    const response = await notion.databases.query({
      database_id: STUDENT_DATABASE_ID,
      page_size: 3
    });

    console.log('Student Database Structure:');
    console.log(JSON.stringify(response.results[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkStudents();
