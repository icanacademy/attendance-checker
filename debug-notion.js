const { Client } = require('@notionhq/client');

const notion = new Client({ auth: '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' });
const DATABASE_ID = '1abd37d6663080ae9307ddbee22c48b1';

async function debugNotionStructure() {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    page_size: 1
  });

  console.log('Full response for one teacher:');
  console.log(JSON.stringify(response.results[0], null, 2));
}

debugNotionStructure().catch(console.error);
