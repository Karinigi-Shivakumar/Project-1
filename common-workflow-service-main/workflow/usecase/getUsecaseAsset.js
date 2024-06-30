const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
const query = `
        SELECT 
        tasks_table.task ->> 'stage' as Stagenames,
        tasks_table.task ->> 'name' as name ,
        metadocs_table.doc_name ,
        metadocs_table.doc_url,
        metadocs_table.id
    FROM metadocs_table
    INNER JOIN tasks_table ON metadocs_table.tasks_id = tasks_table.id
    LEFT JOIN 
         usecases_table on tasks_table.usecase_id = usecases_table.id
    WHERE tasks_table.usecase_id = $1;`
const usecasedata = ` SELECT 
    usecases_table.usecase->>'stages' as usecase
    from usecases_table where id = $1`
const emp_details = `
                    SELECT
                     r.id AS resource_id,
                     COALESCE(r.first_name || ' ' || r.last_name, '') AS resource_name
                     FROM 
                        employee AS r
                     WHERE 
                        r.id = $1`
exports.handler = async (event) => {
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
    const client = await connectToDatabase();
    try {
        const data = await client.query(usecasedata,[usecase_id]);
        const usecaseDataString = data.rows[0].usecase
        const usecaseData =  JSON.parse(usecaseDataString);
        const stageNamesAndStartDates = usecaseData.map(obj => {
            const stageName = Object.keys(obj)[0];
            const startDate = obj[stageName].start_date;
            const status = obj[stageName].status;
            const assignedDate = obj[stageName].assigned_date  || "";
            const assigned_to = obj[stageName].assignee_id || "";
            return { stageName,status, startDate,assignedDate ,assigned_to};
        });
        const employeeDetails = {};
        for (const { assigned_to } of stageNamesAndStartDates) {
            if (assigned_to && !employeeDetails[assigned_to]) {
                const { rows } = await client.query(emp_details, [assigned_to]);
                if (rows.length > 0) {
                    employeeDetails[assigned_to] = rows[0];
                                    }
                                }
                            }                                    
        const { rows } = await client.query(query, [usecase_id]);
        const DocNamesByStage = {};
        rows.forEach(result => {
            const stage = result.stagenames;
            const name = result.name;
            const id = result.id;
            const docName = result.doc_name;
            const Url = result.doc_url;
        
            if (!DocNamesByStage[stage]) {
                DocNamesByStage[stage] = { start_date: "", status:"" ,assigned_date: "" , documents: [] };
            }
            DocNamesByStage[stage].documents.push({ name,id, docName, Url });
        });
        stageNamesAndStartDates.forEach(({ stageName,status, startDate, assignedDate, assigned_to }) => {
            if (DocNamesByStage[stageName]) {
                DocNamesByStage[stageName].status = status;
                DocNamesByStage[stageName].start_date = startDate;
                DocNamesByStage[stageName].assigned_date = assignedDate;
                const resource_name = employeeDetails[assigned_to]?.resource_name || "";
                DocNamesByStage[stageName].assigned_to = resource_name;
            }
        });

        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(DocNamesByStage),
        };
    } catch (e) {
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({  error: e.message || "An error occurred",}),
        };
    } finally {
        await client.end();
    }
};
