import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens=async(userId)=>{
    try {
        const user= await User.findById(userId);
        const accessToken=user.generateAccessToken();
        const refreshToken=user.generateRefreshToken();

        user.refreshToken=refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken,refreshToken};

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token.")
    }
}

const registerUser=asyncHandler(async(req,res)=>{
    // get user details from frontend (here postman)
    // validation - not empty
    // check if user already exists - check: username, email
    // check for images, check for avatar
    // upload them to cloudinary, check avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation: if yes- return response; if no-error

    
    const {username, email, fullname, password} = req.body;
    //console.log(`email:${email}`);


    if(
        [fullname,email,username,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required.")
    }


    const existingUser=await User.findOne({
        $or: [{username},{email}]
    })
    if(existingUser){
        throw new ApiError(409,"User with email or username already exists.")
    }


    const avatarLocalPath=req.files?.avatar[0]?.path;
    //const coverImageLocalPath=req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required.")
    }


    const avatar=await uploadOnCloudinary(avatarLocalPath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar){
        throw new ApiError(400, "Avatar file is required.")
    }


    const user=await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })


    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    );


    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering user.")
    }
    return res.status(201).json(
        new ApiResponse(200, createdUser,"User registered successfully!")
    )

})

const loginUser=asyncHandler(async(req,res)=>{
    // req body -> data
    // username or email required
    // find the user
    // if user present -> password check; if user not present -> error
    // if password valid -> generate access and refresh token; else throw error
    // get the updated user with refresh token -> send cookie

    const {username,email,password}=req.body;

    if(!username && !email){
        throw new ApiError(400,"username or email is required")
    }

    const user= await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist.")
    }

    const isPasswordValid= await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials.")
    }

    const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    //cookie options for security: will not be modifiable at frontend
    const options={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
              .cookie("accessToken",accessToken,options)
              .cookie("refreshToken",refreshToken,options)
              .json(
                new ApiResponse(200,{
                    user:loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully."
                )
              )
})

const logoutUser=asyncHandler(async(req,res)=>{
    // remove accessToken and refreshToken from cookies
    // reset refreshToken

    await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new: true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
              .clearCookie("accessToken",options)
              .clearCookie("refreshToken",options)
              .json(new ApiResponse(200,{},"User logged out successfully."))
})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    // access refreshToken from cookies; if not present -> error
    // verify the token with refresh token secret in .env
    // find the user with the id from decoded token; if no user -> throw error
    // check the cookie refresh token with the found user refresh token; if not same -> throw error
    // generateAccessAndRefreshTokens
    // send in cookie


    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request.")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
        const user= await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401,"Invalid refresh token.")
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used.");
        }
    
    
        const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id);
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        return res.status(200)
                  .cookie("accessToken",accessToken,options)
                  .cookie("refreshToken",refreshToken,options)
                  .json(
                    new ApiResponse(200,{
                        
                        accessToken,
                        refreshToken
                    },
                    "Access token refreshed successfully."
                    )
                  )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token.")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword}=req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password");
    }

    user.password=newPassword;
    await user.save({validateBeforeSave:false});

    return res.status(200).json(new ApiResponse(200,{},"Password changed successfully!"))
})

const getCurrentUser=asyncHandler(async(req,res)=>{
    return res.status(200).json(new ApiResponse(200,req.user,"Current user fetched successfully!"))
})

const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullname,email} = req.body;

    if(!fullname || !email){
        throw new ApiError(400,"All fields are required.");
    }

    const user= await User.findByIdAndUpdate(req.user?._id,
                            {
                                $set:{
                                    fullname,
                                    email: email
                                }
                            },
                            {new:true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,user,"Account details updated successfully."))
})

const updateUserAvatar= asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading")
    }

    const user = User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar:avatar.url
                }
        },
        {
            new:true
        }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200,user,"Avatar updated successfully!"))
})


export {registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar
}