const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
exports.handler = async (event) => {
    const taskId = event.pathParameters?.id ?? null;
    const { resource_id, comment, commentIndex } = JSON.parse(event.body);
    const IdSchema = z.string().uuid({ message: "Invalid Task Id" });
    const isUuid = IdSchema.safeParse(taskId);
    const isUuid1 = IdSchema.safeParse(resource_id);
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
    const newReply = {
        comment: comment,
        commentIndex: commentIndex,
    };
    const replySchema = z.object({
        comment: z.string(),
        commentIndex: z.number().min(0, {
            message: "commentIndex should be either 0 or greater than 0",
        }),
    });
    const validate = replySchema.safeParse(newReply);
    if (!validate.success) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: validate.error.formErrors.fieldErrors,
            }),
        };
    }
    const resourceQuery = ` SELECT id,(r.resource -> 'name') as name,
                                (r.resource -> 'image') as image_url
                            FROM employee as r
                            WHERE id = $1`;
    const client = await connectToDatabase();
    try {
        const resourceQueryResult = await client.query(resourceQuery, [
            resource_id,
        ]);
        const resource = resourceQueryResult.rows[0];
        let reply = JSON.stringify({
            resource: resource,
            comment: comment,
            created_date: new Date(),
        });
        const updatequery = ` UPDATE tasks_table 
                        SET comments = jsonb_set(
                            comments,
                            $1, 
                            $2, 
                            true 
                        )
                       WHERE id = $3;
                    `;

        const updatequeryResult = await client.query(updatequery, [
            `{${commentIndex}, reply}`,
            reply,
            taskId,
        ]);

        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify("updated reply success"),
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal Server Error",
                error: error.message,
            }),
        };
    } finally {
        await client.end();
    }
};