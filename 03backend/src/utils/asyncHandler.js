/* 
APPROACH 1

asyncHandler is a function that takes a function fn as an argument and returns an asynchronous function that conforms to the Express middleware signature (req, res, next)

const asyncHandler=(fn)=>async(req,res,next)=>{
    try {
        await fn(req,res,next)
    } catch (error) {
        res.status(error.code || 500).json({
            success: false,
            message: error.message
        })
    }
}
*/


//APPROACH 2
const asyncHandler=(requestHandler)=>{
    (req,res,next)=>{
        Promise.resolve(
            requestHandler(req,res,next)
        ).catch((err)=>next(err))
    }
}

export {asyncHandler}