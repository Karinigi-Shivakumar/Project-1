const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const { v4: uuid } = require("uuid");
exports.handler = async (event) => {
    const {
        project_id,
        created_by_id,
        usecase_name,
        assigned_to_id,
        description,
        workflow_id,
        start_date,
        end_date,
    } = JSON.parse(event.body);
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
               "Access-Control-Allow-Origin": "*",            },
            body: JSON.stringify({
                error: error,
            }),
        };
    }
    const newUsecase = {
        created_by_id: created_by_id,
        usecase_name: usecase_name,
        assigned_to_id: assigned_to_id,
        description: description,
        start_date: start_date,
        end_date: end_date,
    };
    const UsecaseSchema = z.object({
        created_by_id: z.string().uuid({
            message: "Invalid created by id",
        }),
        usecase_name: z.string()
        .regex(/^[^#%^&*}{;:"><,?\[\]`|@]+$/, {
			message: "name should not contain special symbols",
		})
        .min(3, {
            message: "usecase name should be atleast 3 characters long",
        })
        .max(70, {
            message: "usecase name should should be less than 70 characters long",
        })
        ,
        assigned_to_id: z.string().uuid({
            message: "Invalid assigned to id",
        }),
        description: z.string(),
        start_date: z.coerce.date(),
        end_date: z.coerce.date(),
    });
    const shemaresult = UsecaseSchema.safeParse(newUsecase);
    if (!shemaresult.success) {
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: shemaresult.error.formErrors.fieldErrors,
            }),
        };
    }
    const usecase_id = uuid();
    const usecaseNameWithoutSpaces = usecase_name.replace(/ /g,"_")
    const newUsecaseName = usecase_id.split('-')[4] + "@"+usecaseNameWithoutSpaces;
    const stepFunctionClient = new SFNClient({ region: "us-east-1" });
    const input = {
        stateMachineArn: "",
        name: newUsecaseName,
        input: JSON.stringify({
            flag: "new",
            usecase_id: usecase_id,
            project_id: project_id,
        }),
    };
    let getArnQuery = `select 
                            arn, 
                            metadata->'stages' as stages
                        from 
                            workflows_table 
                        where id = $1`;
    let usecaseExist = `
                        SELECT COUNT(*)
                        FROM usecases_table 
                        WHERE LOWER(usecase->>'name') = LOWER($1)
                        AND project_id = $2::uuid;
    `
    const client = await connectToDatabase();
    try {
        const exists = await client.query(usecaseExist, [usecaseNameWithoutSpaces, project_id])
        if (exists.rows[0].count > 0) {
			return {
				statusCode: 400,
				headers: {
                    "Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({
					message: "usecase with same name already exists in the project",
				}),
			};
		}
        const arnResult = await client.query(getArnQuery, [workflow_id]);
        input.stateMachineArn = arnResult.rows[0].arn;
        const stages = arnResult.rows[0].stages;
        const command = new StartExecutionCommand(input);
        const response = await stepFunctionClient.send(command);
        if (response.$metadata.httpStatusCode == 200) {
            const executionArn = response.executionArn;
            const creationDate = response.startDate;
            console.log("name ", stages[0].name)
            const usecase = {
                name: newUsecaseName,
                creation_date: creationDate,
                created_by_id: created_by_id,
                assigned_to_id: assigned_to_id,
                description: description,
                usecase_assignee_id: "",
                start_date: start_date,
                end_date: end_date,
                current_stage: stages[0].name,
                status: "inprogress",
                stages: generateStages(stages),
            };
            const usecaseInsertQuery = `
                        insert into usecases_table 
                        (id, project_id, workflow_id, arn, usecase, assignee_id)
                        values ($1, $2, $3, $4, $5::jsonb, $6)
                        RETURNING *;
                        `;
            const result = await client.query(usecaseInsertQuery, [
                usecase_id,
                project_id,
                workflow_id,
                executionArn,
                usecase,
                assigned_to_id
            ]);
            console.log(result.rows)
            return {
                statusCode: 201,
                headers: {
                   "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    ...result.rows,
                    usecase_name : result.rows[0].usecase.name.split('@')[1].replace(/_/g," ")
                }),
            };
        } else {
            return {
                statusCode: 500,
                headers: {
                   "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: error.message,
                    error: error
                }),
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message: error.message,
                error: error
            }),
        };
    } finally {
        await client.end();
    }
};

const generateStages = (stages) => {
	return stages.map((stage) => {
		const stageName = stage.name;
		const checklist = stage.checklist;
		return {
			[stageName]: {
				assignee_id: "",
				assigned_by_id: "",
				updated_by_id: "",
				description: "",
        status:"unassigned",
				start_date:"",
				end_date:"",
				checklist: checklist.map((item, index) => ({
					item_id: index + 1,
					description: item,
					checked: false,
				})),
			},
		};
	});
};
