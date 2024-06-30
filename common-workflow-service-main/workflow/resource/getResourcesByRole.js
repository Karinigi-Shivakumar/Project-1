const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
    const designationName = event.queryStringParameters?.designation ?? null;
    const designationSchema = z.string();
    console.log(designationName)
    const isDesignationValid = designationSchema.safeParse(designationName);
    if (!isDesignationValid.success) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: "Invalid designation name",
            }),
        };
    }
    const client = await connectToDatabase();
    try {
        const query = `
                    SELECT 
                    e.id AS emp_id,
                    COALESCE(e.first_name || ' ' || e.last_name, '') AS resource_name,
                    COALESCE(e.work_email, '') as work_email,
                    COALESCE(e.image, '') AS image,
                    d.designation  as designation
                    
                FROM 
                    emp_detail ed
                LEFT JOIN 
                    employee e ON ed.emp_id = e.id
                LEFT join
                    emp_designation d on ed.designation_id = d.id
                WHERE 
                    LOWER(d.designation) = LOWER($1)`;

        const result = await client.query(query, [designationName]);

        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(result.rows),
        };
    } catch (error) {
        console.error("Error executing query:", error);
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
