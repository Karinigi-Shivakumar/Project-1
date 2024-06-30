const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
exports.handler = async (event) => {
    const { resource_name, email, role, project, description } = JSON.parse(event.body);
    const resourceObj = {
        name: resource_name,
        email: email,
        role: role,
        project: project,
        description: description,
        image: '',
        current_task: {
            task_id: '',
            task_name: '',
            created_date: '',
            due_date: ''
        }
    };
    const resourceSchema = z.object({
        name: z.string().min(3, {
            message: "resource name should be at least 3 characters long",
        }),
        email: z.string().email({
            message: "Invalid email address",
        }),
        role: z.string().min(2, {
            message: "Role should be at least 2 characters long",
        }),
        project: z.string().min(3, {
            message: "Project name should be at least 3 characters long",
        }),
        description: z.string().min(5, {
            message: "Description should be at least 5 characters long",
        }),
    });
    const result = resourceSchema.safeParse(resourceObj);
    if (!result.success) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: result.error.formErrors.fieldErrors,
            }),
        };
    }
    const client = await connectToDatabase();
    try {
        const insertedResource = await client.query({
            text: `
                INSERT INTO employee (resource)
                VALUES ($1)
                RETURNING id
            `,
            values: [JSON.stringify(resourceObj)]
        });
        const resourceId = insertedResource.rows[0].id;
        resourceObj.id = resourceId;
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(resorceObj)
        };
    } catch (error) {
        console.error("Error: ", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                message: error.message,
                error: error,
            }),
        };
    } finally {
        await client.end();
    }
};
