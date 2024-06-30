
const { z } = require("zod")
const { uploadToS3 } = require("../util/uploadDocs")

exports.handler = async event => {
	const { doc_name, data } = JSON.parse(event.body)
	const metadocsObj = {
		doc_name: doc_name,
		data: data,
	}
	const metadocsSchema = z.object({
		doc_name: z.string(),
		data: z.string({
			message: "invalid string",
		}),
	})
	const result = metadocsSchema.safeParse(metadocsObj)
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
		}
	}
	try {
		const upload = await uploadToS3(doc_name, data)
		console.log("upload :", upload.link)
		const url = upload.link
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify({ url }),
		}
	} catch (error) {
		console.error("Error inserting data:", error)
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
		}
	} 
}
