const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
exports.handler = async (event) => {
    const requestBody = JSON.parse(event.body);
	const usecase_id = event.pathParameters?.id ?? null;
    const usecaseIdSchema = z.string().uuid({message : "Invalid usecase id"})
    const isUuid = usecaseIdSchema.safeParse(usecase_id)
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
    const {
        stage_name,
        assigned_to_id,
        description,
    } = requestBody;
    const client = await connectToDatabase();
    try {
        const assigned_date = new Date().toISOString();
        const result = await client.query(
            "SELECT usecase FROM usecases_table WHERE id = $1",
            [usecase_id]
        );
        if (result.rowCount === 0) {
            return {
                statusCode: 400,
                headers: {
                   "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
                },
                body: JSON.stringify({ message: "Usecase not found" }),
            };
        }
        const existingData = result.rows[0].usecase;
        existingData.stages.forEach((stageObj) => {
            const stageKey = Object.keys(stageObj)[0];

            if (stageKey === stage_name) {
                const stageData = stageObj[stageKey];
                console.log(stageData);

                stageData.assignee_id = assigned_to_id;
                stageData.status = "inprogress";
                if (!stageData.description)
                    stageData.description = description;
                if (!stageData.assigned_date)
                    stageData.assigned_date = assigned_date;
            }
        });
        await client.query(`  UPDATE usecases_table
                               SET usecase = $1 WHERE id = $2 `,[existingData, usecase_id]);                           
        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ message: "Stage assigned successfully" }),
        };
    } catch (error) {
        console.error("error", error);
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ message: "Error while assigning" }),
        };
    } finally {
        await client.end();
    }
};
