const { connectToDatabase } = require("../db/dbConnector");
const org_id = "482d8374-fca3-43ff-a638-02c8a425c492";
exports.handler = async (event) => {
	const getWorkflows = `  
                        SELECT
                            w.id,
                            w.name,
							w.created_by,
                            w.metadata->'stages' AS stages,
							e.first_name,
							e.last_name,
							e.image,
							edg.designation
                        FROM                            
                        	workflows_table w
						LEFT JOIN
        					employee e ON e.id = w.created_by
						LEFT JOIN
							emp_detail ed ON e.id = ed.emp_id
						LEFT JOIN
        					emp_designation edg ON ed.designation_id = edg.id`;
	const client = await connectToDatabase();
	try {
		const getWorkflowsResult = await client.query(getWorkflows);
		console.log(getWorkflowsResult)
		const response = getWorkflowsResult.rows.map(({ id, name, created_by, first_name, last_name, designation, image, stages }) => {
			return {
				id,
				name : name.split('@')[1].replace(/_/g," "),
				stages,
				created_by : {
				id: created_by || "",
				first_name,
				last_name,
				designation,
				image: image || "",
			}
			};
		});
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify(response),
		};
	} catch (error) {
		console.error("Error executing query", error);
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
