export function constructPhoneNumber(cad: string) {
  if (!cad) return null;
  const solved = cad.toString().replace(/\D+/g, '');
  if (solved.length < 11) return '+1'.concat(solved);
  return '+'.concat(solved);
}

export function calculateTimeDifference(date1: Date, date2: Date): string {
  const difference = Math.abs(date2.getTime() - date1.getTime());

  const milliseconds = difference % 1000;
  const seconds = Math.floor((difference / 1000) % 60);
  const minutes = Math.floor((difference / (1000 * 60)) % 60);
  const hours = Math.floor(difference / (1000 * 60 * 60));

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds
    .toString()
    .padStart(3, '0')}`;
}

/**
 * Converts properties ending with 'Id' in the DTO or each object within an array of DTOs to objects of the corresponding type.
 * If a second parameter is provided, only the properties listed in that array will be converted.
 * If the DTO is null or undefined, returns null.
 *
 * @param dto - The DTO object or an array of DTO objects to convert.
 * @param keysToConvert - An optional array of property names to specifically convert.
 *                         If provided, only these properties will be converted.
 * @returns The converted DTO object or array of objects with 'Id' properties converted to nested objects or null.
 */
export function convertIdsToObjects(dto: any, keysToConvert?: string[]): any {
  // If dto is null or undefined, return null
  if (dto === null || dto === undefined) {
    return null;
  }

  // If dto is an array, process each item in the array
  if (Array.isArray(dto)) {
    return dto.map((item) => convertIdsToObjects(item, keysToConvert));
  }

  // Process a single DTO object
  const convertedDto: any = { ...dto };

  for (const key in dto) {
    // Check if the key ends with 'Id'
    const isIdProperty = key.endsWith('Id');

    // If keysToConvert is provided, only process the properties listed in that array
    const shouldConvert = keysToConvert
      ? keysToConvert.includes(key)
      : isIdProperty;

    if (shouldConvert) {
      if (dto[key] !== undefined && dto[key] !== null) {
        const objectKey = key.slice(0, -2); // Remove 'Id' from the end of the property
        convertedDto[objectKey] = { id: dto[key] };
      } else {
        const objectKey = key.slice(0, -2); // Remove 'Id' from the end of the property
        convertedDto[objectKey] = null;
      }
      delete convertedDto[key]; // Remove the original 'Id' property
    }
  }

  return convertedDto;
}
