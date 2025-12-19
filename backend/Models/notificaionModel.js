import mongoose from "mongoose"

const notificationSchema = new mongoose.Schema({
    from:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    to:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    type:{
        type:String,
        required:true,
        enum:['follow','like','reply']
    },
    postImg:{
        type:String,
        default:null
    },
    postVideo:{
        type:String,
        default:null
    },
    postVideoFileId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null
    },
    hasVideo:{
        type:Boolean,
        default:false
    },
    likedText:{
        type:String,
        default:""
    },
    read:{
        type:Boolean,
        default:false
    },
    postUsername:{
        user:String,
        
    },
    postUserimg:{
        img:String
    }


},{timestamps:true})

const Notification = mongoose.model("Notification",notificationSchema)

export default Notification