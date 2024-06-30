const generateStateMachine2 = (stages) => {
    const firstStageName = stages[0].name;
    const newStepFunction = {
        Comment: "My test workflow state machine",
        StartAt: firstStageName,
        States: {},
    };
 
    let previousStageName = firstStageName;
 
    for (let i = 0; i < stages.length; i++) {
        const currentStageName = stages[i].name;
        const tasks = stages[i].tasks || [];
 
        const stage = {
            Type: "Task",
            Resource: "arn:aws:lambda:us-east-1:657907747545:function:workflow-process-lambda:$LATEST",
            Parameters: {
                [`payload.$`]: "$",
                [`stateName.$`]: "$$.State.Name",
            },
            Retry: [
                {
                    ErrorEquals: [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException",
                    ],
                    IntervalSeconds: 1,
                    MaxAttempts: 3,
                    BackoffRate: 2,
                },
            ],
            ResultPath:"$",
        };
 
        const nextStageName = i < stages.length - 1 ? stages[i + 1].name : "end";
        stage.Next = currentStageName + "-tasks";
 
        newStepFunction.States[currentStageName] = stage;
 
        const tasksObjArray = tasks.map((task, index) => {
            return {
                StartAt: task,
                States: {
                    [task]: {
                        Type: "Task",
                        Resource: "arn:aws:states:::lambda:invoke.waitForTaskToken",
                        Parameters: {
                            FunctionName: "workflow-parallel-task-lambda",
                            Payload: {
                                [`executionArn.$`]: "$$.Execution.Id",
                                [`token.$`]: "$$.Task.Token",
                                [`taskName.$`]: "$$.State.Name",
                                [`payload.$`]: "$",
                            },
                        },
                        End: true,
                    },
                },
            };
        });
 
        newStepFunction.States[currentStageName + "-tasks"] = {
            Type: "Parallel",
            Branches: tasksObjArray,
            ResultPath:"$.array",
            Next: currentStageName + "-complete",
        };
 
        newStepFunction.States[currentStageName + "-complete"] = {
            Type: "Task",
            Resource: "arn:aws:lambda:us-east-1:657907747545:function:workflow-complete-stage",
            ResultPath:"$",
            Next: nextStageName,
        };
 
        if (i === 0) {
            newStepFunction.States[previousStageName].Next = currentStageName + "-tasks";
        } else {
            newStepFunction.States[previousStageName + "-complete"].Next = currentStageName;
        }
 
        previousStageName = currentStageName;
    }
 
    newStepFunction.States["end"] = {
        Type: "Task",
        Resource: "arn:aws:lambda:us-east-1:657907747545:function:workflow-complete-usecase",
        End: true,
    };
 
    return newStepFunction;
};
 
 
 
const generateStateMachine1 = (stages) => {
    const newStepFunction = {
        Comment: "My test workflow state machine",
        StartAt: "stages",
        States: {
            stages: {
                Type: "Parallel",
                Next: "FinalStage",
                ResultPath: "$.array",
                Branches: [],
            },
            FinalStage: {
                Type: "Task",
                Resource: "arn:aws:lambda:us-east-1:657907747545:function:workflow-complete-usecase",
                End: true,
            },
        },
    };
    for (let i = 0; i < stages.length; i++) {
        const currentStage = stages[i];
        const currentStageName = currentStage.name;
        const nextStageName = currentStageName + "-tasks";
        const stage = {
            StartAt: currentStageName,
            States: {},
        };
        stage.States[currentStageName] = {
            Type: "Task",
            Resource: "arn:aws:lambda:us-east-1:657907747545:function:workflow-process-lambda:$LATEST",
            Parameters: {
                [`payload.$`]: "$",
                [`stateName.$`]: "$$.State.Name",
            },
            Retry: [
                {
                    ErrorEquals: [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ],
                    IntervalSeconds: 1,
                    MaxAttempts: 3,
                    BackoffRate: 2
                }
            ],
            Next: nextStageName,
            ResultPath: "$"
        };
 
        const tasks = currentStage.tasks || [];
        const tasksObjArray = tasks.map((task) => {
            return {
                StartAt: task,
                States: {
                    [task]: {
                        Type: "Task",
                        Resource: "arn:aws:states:::lambda:invoke.waitForTaskToken",
                        Parameters: {
                            FunctionName: "workflow-parallel-task-lambda",
                             Payload: {
                                [`executionArn.$`]: "$$.Execution.Id",
                                [`token.$`]: "$$.Task.Token",
                                [`taskName.$`]: "$$.State.Name",
                                [`payload.$`]: "$",
                            },
                        },
                        End: true
                    }
                }
            };
        });
 
        stage.States[nextStageName] = {
            Type: "Parallel",
            Branches: tasksObjArray,
            ResultPath: "$.array",
            Next: `complete-${currentStageName}`
        };
 
        stage.States[`complete-${currentStageName}`] = {
            Type: "Task",
            Resource: "arn:aws:lambda:us-east-1:657907747545:function:workflow-complete-stage",
            ResultPath: "$",
            End: true
        };
 
        newStepFunction.States.stages.Branches.push(stage);
    }
 
    return newStepFunction;
};
module.exports = {generateStateMachine2, generateStateMachine1} ;