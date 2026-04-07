import mongoose, { Document, Schema } from "mongoose";

export interface INotificationSetting extends Document {
  key: string;
  message: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSettingSchema: Schema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    isActive: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const NotificationSetting =
  mongoose.models.NotificationSetting ||
  mongoose.model<INotificationSetting>("NotificationSetting", NotificationSettingSchema);
