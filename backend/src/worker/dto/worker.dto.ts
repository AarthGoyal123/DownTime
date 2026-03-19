import { IsString, IsNumber, IsOptional, Min, Max, IsInt } from 'class-validator';

export class CreateWorkerDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  city: string;

  @IsString()
  zone: string;

  @IsString()
  platform: string;

  @IsNumber()
  @Min(200)
  @Max(2000)
  dailyIncome: number;

  @IsInt()
  @Min(4)
  @Max(12)
  @IsOptional()
  workingHours?: number = 8;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  workStartHour?: number = 9;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  workEndHour?: number = 19;
}

export class UpdateWorkerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  zone?: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsNumber()
  @Min(200)
  @Max(2000)
  @IsOptional()
  dailyIncome?: number;

  @IsInt()
  @Min(4)
  @Max(12)
  @IsOptional()
  workingHours?: number;
}
