const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
    const usecase_id = event.pathParameters?.id;

    const uuidSchema = z.string().uuid({ message: "Invalid Usecase Id" });
    const isUuid = uuidSchema.safeParse(usecase_id);

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
    const query = `
				SELECT
				t.id as task_id,
				t.task AS task,
				t.assignee_id,
				CONCAT(e.first_name, ' ', e.last_name) AS assignee_name,
				e.image AS assignee_image,
				edd.designation AS assignee_designation,
				json_agg(
					json_build_object(
						'id', d.id,
						'name', d.doc_name,
						'doc_url', d.doc_url,
						'created_time', d.created_time,
                        'type', d.type
					)
				) AS docs
			FROM
				tasks_table t
			LEFT JOIN
				employee e ON t.assignee_id = e.id
			LEFT JOIN   
				emp_detail ed ON e.id = ed.emp_id
			LEFT JOIN
				emp_designation edd ON edd.id = ed.designation_id
			LEFT JOIN (
				SELECT
					tasks_id,
					id,
					doc_name,
					doc_url,
					created_time,
                    type
				FROM
					metadocs_table
			) AS d ON d.tasks_id = t.id
			WHERE
				t.usecase_id = $1
			GROUP BY
				t.id, t.task, t.assignee_id, CONCAT(e.first_name, ' ', e.last_name), e.image, edd.designation;
`;
    const usecaseQuery = `
        SELECT 
            usecase as usecase
        FROM     
            usecases_table
        WHERE id = $1::uuid
        `;
    try {
        const usecaseRes = await client.query(usecaseQuery, [usecase_id]);
        const result = await client.query(query, [usecase_id]);

        if (result.rows.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify([]),
            };
        }
        let assigneeIds = [];
        const usecaseData = usecaseRes.rows[0].usecase;
        usecaseData.stages.forEach((stage) => {
            const stageName = Object.keys(stage)[0];
            const assigneeId = usecaseData.stages.find((s) => Object.keys(s)[0] === stageName)?.[stageName].assignee_id;
            assigneeIds.push(assigneeId);
        });
        let employee_details = { rows: [] };
		if (assigneeIds && assigneeIds.every(id => id !== '')){
			const employeeQuery = `
				SELECT
					e.id AS employee_id,
					CONCAT(e.first_name, ' ', e.last_name) AS assignee_name,
					e.image AS assignee_image,
					edd.designation AS employee_designation
				FROM
					employee e
				LEFT JOIN    
					emp_detail ed ON e.id = ed.emp_id
				LEFT JOIN
					emp_designation edd ON edd.id = ed.designation_id        
				WHERE
					e.id IN (${assigneeIds.map((id) => `'${id}'`).join(",")})
				`;
			employee_details = await client.query(employeeQuery);
		}
		
        usecaseData.stages.forEach((stage) => {
            const stageName = Object.keys(stage)[0];
            const assigneeId = usecaseData.stages.find((s) => Object.keys(s)[0] === stageName)?.[stageName].assignee_id;
            const employee = employee_details.rows.find((emp) => emp.employee_id === assigneeId);
           
            if (employee) {
                stage[stageName].assigned_to = {
                    id: employee.employee_id,
                    name: employee.assignee_name,
                    image: employee.assignee_image || "",
                    designation: employee.employee_designation
                };
            } else {
                stage[stageName].assigned_to = {};
            }

            const tasksForStage = result.rows.filter((row) => row.task.stage === stageName);
            stage[stageName].tasks = tasksForStage.map((row) => {
                let assignee;
                if (row.assignee_id !== null) {
                    assignee = {
                        id: row.assignee_id,
                        image: row.assignee_image || "",
                        name: row.assignee_name,
                        designation: row.assignee_designation,
                    };
                }
                return {
                    id: row.task_id,
                    name: row.task.name,
                    status: row.task.status,
                    assigned_to: assignee || {},
                    docs: row.docs
                        .filter((doc) => doc.id !== null)
                        .map((doc) => ({
                            doc_name: doc.name,
                            doc_id: doc.id,
                            doc_url: doc.doc_url,
                            created_time: doc.created_time,
                            type: doc.type
                        })),
                };
            });
        });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(usecaseData),
        };
    } catch (error) {
        console.error("Error executing query:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
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
