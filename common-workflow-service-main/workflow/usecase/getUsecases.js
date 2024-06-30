const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
exports.handler = async (event) => {
    const project_id = event.queryStringParameters?.project_id;
    const workflow_id = event.queryStringParameters?.workflow_id;
    const IdSchema = z.string().uuid({ message: "Invalid id" });
    const isUuid = IdSchema.safeParse(project_id);
    const isUuid1 = IdSchema.safeParse(workflow_id);
    if (
        !isUuid.success ||
        !isUuid1.success ||
        (!isUuid.success && !isUuid1.success)
    ) {
        const error =
            (isUuid.success ? "" : isUuid.error.issues[0].message) +
            (isUuid1.success ? "" : isUuid1.error.issues[0].message);
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: error,
            }),
        };
    }
    const client = await connectToDatabase();
    try {
        let query = `
            SELECT
                usecases_table.id AS usecase_id,
                usecases_table.usecase->>'name' AS usecase_name,
                usecases_table.usecase->'stages' as stages,
                usecases_table.usecase->>'current_stage' AS current_stage,
                usecases_table.assignee_id AS usecase_assigned_id,
                employee.first_name AS assignee_first_name,
                employee.last_name AS assignee_last_name,
                COUNT(DISTINCT tasks_table.assignee_id) AS total_resources,
                usecases_table.usecase->>'start_date' AS start_date,
                usecases_table.usecase->>'end_date' AS end_date
            FROM
                usecases_table
            LEFT JOIN
                tasks_table ON usecases_table.id = tasks_table.usecase_id
            LEFT JOIN
                employee ON usecases_table.assignee_id = employee.id
            WHERE
                usecases_table.project_id = $1
                AND usecases_table.workflow_id = $2
            GROUP BY 
                usecases_table.id, 
                usecases_table.usecase->>'name',
                usecases_table.usecase->'stages',
                usecases_table.usecase->>'current_stage',
                usecases_table.assignee_id,
                employee.first_name,
                employee.last_name,
                usecases_table.usecase->>'start_date',
                usecases_table.usecase->>'end_date';
        `;

        const params = [project_id, workflow_id];

        const result = await client.query(query, params);
        const usecases = result.rows.map((row) => ({
            usecase_id: row.usecase_id,
            usecase_name: row.usecase_name.split('@')[1].replace(/_/g," "),
            current_stage: row.current_stage,
            assignee_id: row.usecase_assigned_id || "",
            assignee_name: ((row.assignee_first_name || "") + " " + (row.assignee_last_name || "")) || "",
            total_resources: parseInt(row.total_resources) || 0,
            start_date: row.start_date,
            end_date: row.end_date,
        }));
         const s = result.rows[0].stages.map( obj => Object.keys(obj)[0])
         const response = {
            stages : s,
            usecases : usecases
         }
        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(response),
        };
    } catch (e) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: e.message || "An error occurred",
            }),
        };
    } finally {
        await client.end();
    }
};