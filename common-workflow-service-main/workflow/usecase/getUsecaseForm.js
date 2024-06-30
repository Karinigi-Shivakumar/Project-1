const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
    const usecaseId = event.pathParameters?.id ?? null;
    const usecaseIdSchema = z.string().uuid({message : "Invalid usecase id"})
    const isUuid = usecaseIdSchema.safeParse(usecaseId)
    if(!isUuid.success){
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: isUuid.error.issues[0].message
            }),
        };
    }
    const client = await connectToDatabase();

    try {
        const query = `
            SELECT u.usecase,
                   t.id AS id,
                   t.task->>'name' AS task_name,
                   t.task->>'stage' AS stage_name,
                   t.task->>'assign_id' AS assignee_id,
                   t.task->>'description' AS description,
                   t.task->>'start_date' AS task_start_date,
                   t.task->>'end_date' AS task_end_date
              FROM usecases_table u
                   JOIN tasks_table t ON u.id = t.usecase_id
                   JOIN projects_table p ON u.project_id = p.id
             WHERE u.id = $1
        `;

        const jsonData = await client.query(query, [usecaseId]);
        const usecaseData = jsonData.rows[0];
        const stageDetails = usecaseData.usecase.stages.map(stage => {
            const stageName = Object.keys(stage)[0];
            const stageData = stage[stageName];

            const matchingTaskDetails = jsonData.rows
                .filter(row => row.stage_name === stageName)
                .map(row => ({
                    id: row.id,
                    name: row.task_name,
                    assignee_id: row.assignee_id !== null ? row.assignee_id  : '',
                    start_date: usecaseData.task_start_date,
                    end_date: usecaseData.task_end_date,
                }));

            return {
                [stageName]: {
                    assignee_id: stageData.assignee_id,
                    description: stageData.description,
                    start_date: stageData.start_date,
                    end_date: stageData.end_date,
                    tasks: matchingTaskDetails,
                },
            };
        });
        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(stageDetails),
        };
    } catch (e) {
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ error: e.message || "An error occurred"}),
        };
    } finally {
        await client.end();
    }
};
