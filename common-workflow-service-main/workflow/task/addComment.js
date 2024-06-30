const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
    const task_id = event.pathParameters?.id ?? null;
    if (!task_id) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ error: "Missing task_id parameter" }),
        };
    }
    const client = await connectToDatabase();
    const { id, comment } = JSON.parse(event.body);
    const resourceQuery = `select id,(r.resource -> 'name') as name,
                            (r.resource -> 'image') as image_url
                          from employee as r
                          where id = $1`;
    const updatequery =
        "update tasks_table set comments = comments || $1 where id = $2";
    try {
        const resourceQueryResult = await client.query(resourceQuery, [id]);
        const resource = resourceQueryResult.rows[0];
        let comments = JSON.stringify({
            resource: resource,
            comment: comment,
            created_date: new Date(),
            reply: {},
        });
        const updatequeryResult = await client.query(updatequery, [
            comments,
            task_id,
        ]);
        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify("comment added"),
        };
    } catch (error) {
        console.error("Error executing query", error);
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ error: "Internal Server Error" }),
        };
    } finally {
        await client.end();
    }
};
