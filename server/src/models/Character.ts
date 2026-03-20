import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacter extends Document {
  name: string;
  description?: string;
  bodyColor: string;
  flowerColor: string;
  visorColor: string;
  flowerType: string;
  createdAt: Date;
}

const hexColorValidator = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

const CharacterSchema = new Schema<ICharacter>({
  name: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 20,
    trim: true,
  },
  description: {
    type: String,
    maxlength: 100,
    default: '',
  },
  bodyColor: {
    type: String,
    required: true,
    validate: { validator: hexColorValidator, message: 'Invalid hex color' },
  },
  flowerColor: {
    type: String,
    required: true,
    validate: { validator: hexColorValidator, message: 'Invalid hex color' },
  },
  visorColor: {
    type: String,
    required: true,
    validate: { validator: hexColorValidator, message: 'Invalid hex color' },
  },
  flowerType: {
    type: String,
    required: true,
    enum: ['daisy'],
    default: 'daisy',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema);
