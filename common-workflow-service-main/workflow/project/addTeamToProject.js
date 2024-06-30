const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
exports.handler = async (event) => {
	const project_id = event.pathParameters?.id ?? null;
	const projectIdSchema = z.string().uuid({message : "Invalid project id"})
	const isUuid = projectIdSchema.safeParse(project_id)
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
	const requestBody = JSON.parse(event.body);
		const { team_name, created_by_id, roles } = requestBody;
		const TeamSchema = z.object({
			name : z
			.string()
			.min(3, {
				message: "Team name must be atleast 3 charachters long",
			}),
			created_by_id: z.string().uuid({
				message: "Invalid created by id",
			}),
			created_time :  z.string().datetime(),
			//check for roles names to be unique --- TO DO--
			roles : z.array(
				z.record(z.string(), z.string().uuid().array().nonempty())
				)
		})

		const team = {
			name: team_name,
			created_by_id: created_by_id,
			created_time: new Date().toISOString(),
			roles: roles,
		};
		const result = TeamSchema.safeParse(team);
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
		console.log(JSON.stringify(team))
	const client = await connectToDatabase();
	const query = `
                update projects_table
                set project = jsonb_set(
                    project,
                    '{team}',
                    coalesce(project->'team', '{}'::jsonb) || $1::jsonb,
                    true
                )
                where 
                    id = $2`;
	try {
		const res = await client.query(query, [team, project_id]);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify({
				message: "Team added to the project",
			}),
		};
	} catch (error) {
		console.error("Error updating data:", error);
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify({ message: "Internal Server Error" }),
		};
	} finally {
		await client.end();
	}
};
