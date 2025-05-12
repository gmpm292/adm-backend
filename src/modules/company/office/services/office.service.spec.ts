import { Test, TestingModule } from '@nestjs/testing';
import { OfficeService } from './office.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AddressService } from '../../../shared/address/services/address.service';
import { PhoneService } from '../../../shared/phone/services/phone.service';
import { Office } from '@app/shared/entities';

describe('OfficeService', () => {
  let officeService: OfficeService;
  let addressService: AddressService;
  addressService;
  let phoneService: PhoneService;
  phoneService;

  const mockAddressService = {};
  const mockPhoneService = {};
  const mockOfficeRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfficeService,
        AddressService,
        PhoneService,
        {
          provide: getRepositoryToken(Office),
          useValue: mockOfficeRepository,
        },
      ],
    })
      .overrideProvider(AddressService)
      .useValue(mockAddressService)
      .overrideProvider(PhoneService)
      .useValue(mockPhoneService)
      .compile();

    officeService = module.get<OfficeService>(OfficeService);
  });

  it('should be defined', () => {
    expect(officeService).toBeDefined();
  });
});
