const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
    const tasks_id = event.pathParameters?.taskId;
    const taskIdSchema = z.string().uuid({ message: "Invalid Task_id" });
    const isUuid = taskIdSchema.safeParse(tasks_id);
    if (!isUuid.success) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: isUuid.error.issues[0].message,
            }),
        };
    }
    const client = await connectToDatabase();
    try {
        const query = `
        SELECT metadocs_table.created_by,
            metadocs_table.doc_name,
            metadocs_table.id as doc_id,
            metadocs_table.doc_url,
            employee.first_name || ' ' || last_name AS resource_name,
            employee.work_email  as email ,
            employee.image as image,
            metadocs_table.created_time
        FROM metadocs_table
            INNER JOIN tasks_table ON metadocs_table.tasks_id = tasks_table.id
            LEFt JOIN employee on metadocs_table.created_by = employee.id
            WHERE tasks_table.id = $1;
        `;
        const TaskMetaData = await client.query(query, [tasks_id]);
            const resultArray = TaskMetaData.rows.map(row => ({
                doc_name: row.doc_name || "",
                doc_id: row.doc_id || "",
                resource_id: row.created_by || "",
                 resource_name: row.resource_name || "",
                email: row.email || "" ,
                image: row.image || "" ,
                created_time: row.created_time || "",
                doc_url: row.doc_url || ""
            }));
        return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(resultArray),
		};
    } catch (e) {
        return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message : e.message,
				error : e
			}),
		};
    } finally {
        await client.end();
    }
};
