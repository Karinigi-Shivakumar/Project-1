const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
exports.handler = async (event) => {
	const { name, description, department, start_date, end_date, image_url } =
		JSON.parse(event.body);
	const newProject = {
		name: name,
		description: description,
		department: department,
		start_date: start_date,
		end_date: end_date,
		image_url: image_url,
	};
	const ProjectSchema = z.object({
		name: z
			.string()
			.min(3, {
				message: "Project name must be atleast 3 charachters long",
			}).regex(/^[^-]*$/, {
				message : 'name should not contain `-`'
			}),
		description: z.string(),
		department: z.string(),
		start_date: z.coerce.date(),
		end_date: z.coerce.date(),
		image_url: z.string().url({ message: "Invalid url for project icon" }).optional(),
	});

	const result = ProjectSchema.safeParse(newProject);
	if (!result.success) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: result.error.formErrors.fieldErrors,
			}),
		};
	}
	const client = await connectToDatabase();
	try {
		const isDuplicate = await client.query(`SELECT COUNT(*) FROM projects_table WHERE LOWER(project->>'name') = LOWER($1)`, [newProject.name]);
		if (isDuplicate.rows[0].count > 0) {
			return {
				statusCode: 400,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					message: "project with same name already exists",
				}),
			};
		}
		const project = {
			name: newProject.name,
			status: "unassigned",
			description: newProject.description,
			department: newProject.department,
			image_url: newProject.image_url,
			current_stage: "",
			start_date: newProject.start_date,
			end_date: newProject.end_date,
			updated_by: {},
			workflows: [],
			team: {},
		};
		const result = await client.query(
			`INSERT INTO projects_table (project) VALUES ($1::jsonb) RETURNING *`,
			[project]
		);
		const insertedData = result.rows[0];
		insertedData.project.id = insertedData.id;
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(insertedData.project),
		};
	} catch (error) {
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