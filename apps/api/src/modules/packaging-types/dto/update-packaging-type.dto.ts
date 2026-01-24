import { PartialType } from '@nestjs/mapped-types';
import { CreatePackagingTypeDto } from './create-packaging-type.dto';

export class UpdatePackagingTypeDto extends PartialType(CreatePackagingTypeDto) {}
