import { IsInt, IsString,Min } from 'class-validator'

export class CreateKeyLimitDto{
    @IsString()
    apiKey!: string;

    @IsInt()
    @Min(1)
    limitPerWindow!: number;
}