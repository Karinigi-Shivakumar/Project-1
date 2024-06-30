const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
    const id = event.pathParameters?.id;
    if (!id) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: "Task Id is missing or invalid",
            }),
        };
    }

    const uuidSchema = z.string().uuid({ message: "Invalid Task Id" });
    const isUuid = uuidSchema.safeParse(id);

    if (!isUuid.success) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: isUuid.error.issues[0].message,
            }),
        };
    }

    const client = await connectToDatabase();
    try {
        const taskQuery = `
            SELECT 
            id,
            task
            FROM tasks_table
            WHERE id = $1
        `;
        const taskResult = await client.query(taskQuery, [id]);

        if (taskResult.rows.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    error: "Task not found",
                }),
            };
        }

        const taskDetails = taskResult.rows[0].task;

        const docQuery = `
            SELECT metadocs_table.doc_name,
                metadocs_table.id as doc_id,
                metadocs_table.doc_url,
                metadocs_table.created_time
            FROM metadocs_table
            INNER JOIN tasks_table ON metadocs_table.tasks_id = tasks_table.id
            WHERE tasks_table.id = $1;
        `;
        const docResult = await client.query(docQuery, [id]);
        const docs = docResult.rows.map(row => ({
            doc_name: row.doc_name || "",
            doc_id: row.doc_id || "",
            created_time: row.created_time || "",
            doc_url: row.doc_url || ""
        }));

        const response = {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                task_id: taskResult.rows[0].id,
                task_name: taskDetails.name,
                status: taskDetails.status,
                docs: docs
            }),
        };

        return response;
    } catch (error) {
        console.error("Error executing query:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message: error.message,
                error: error.stack,
            }),
        };
    } finally {
        await client.end();
    }
};
