import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInitialUnits1772639092743 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Weight / Peso
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Gramo', 'g', 'peso', true),
        ('Kilogramo', 'kg', 'peso', true),
        ('Miligramo', 'mg', 'peso', true),
        ('Tonelada Métrica', 't', 'peso', true),
        ('Libra', 'lb', 'peso', true),
        ('Onza', 'oz', 'peso', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Volume / Volumen
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Litro', 'L', 'volumen', true),
        ('Mililitro', 'mL', 'volumen', true),
        ('Metro Cúbico', 'm³', 'volumen', true),
        ('Galón (US)', 'gal', 'volumen', true),
        ('Taza', 'cup', 'volumen', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Length / Longitud
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Metro', 'm', 'longitud', true),
        ('Centímetro', 'cm', 'longitud', true),
        ('Milímetro', 'mm', 'longitud', true),
        ('Kilómetro', 'km', 'longitud', true),
        ('Pulgada', 'in', 'longitud', true),
        ('Pie', 'ft', 'longitud', true),
        ('Yarda', 'yd', 'longitud', true),
        ('Milla', 'mi', 'longitud', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Area / Área
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Metro Cuadrado', 'm²', 'área', true),
        ('Pie Cuadrado', 'ft²', 'área', true),
        ('Acre', 'ac', 'área', true),
        ('Hectárea', 'ha', 'área', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Count / Unidades
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Unidad', 'unidad', 'unidades', true),
        ('Pieza', 'pza', 'unidades', true),
        ('Docena', 'doc', 'unidades', true),
        ('Par', 'par', 'unidades', true),
        ('Caja', 'caja', 'unidades', true),
        ('Rollo', 'rollo', 'unidades', true),
        ('Juego', 'juego', 'unidades', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Time / Tiempo
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Hora', 'h', 'tiempo', true),
        ('Día', 'd', 'tiempo', true),
        ('Semana', 'sem', 'tiempo', true),
        ('Mes', 'mes', 'tiempo', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Energy / Energía
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Kilovatio-hora', 'kWh', 'energía', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Power / Potencia
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Vatio', 'W', 'potencia', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);

    // Temperature / Temperatura
    await queryRunner.query(`
      INSERT INTO "in_units_of_measure" (name, symbol, category, "isActive") 
      SELECT * FROM (VALUES
        ('Grado Celsius', '°C', 'temperatura', true),
        ('Grado Fahrenheit', '°F', 'temperatura', true)
      ) AS v(name, symbol, category, "isActive")
      WHERE NOT EXISTS (
        SELECT 1 FROM "in_units_of_measure" WHERE name = v.name OR symbol = v.symbol
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar todas las unidades insertadas
    await queryRunner.query(`
      DELETE FROM "in_units_of_measure" 
      WHERE name IN (
        'Gramo', 'Kilogramo', 'Miligramo', 'Tonelada Métrica', 'Libra', 'Onza',
        'Litro', 'Mililitro', 'Metro Cúbico', 'Galón (US)', 'Taza',
        'Metro', 'Centímetro', 'Milímetro', 'Kilómetro', 'Pulgada', 'Pie', 'Yarda', 'Milla',
        'Metro Cuadrado', 'Pie Cuadrado', 'Acre', 'Hectárea',
        'Unidad', 'Pieza', 'Docena', 'Par', 'Caja', 'Rollo', 'Juego',
        'Hora', 'Día', 'Semana', 'Mes',
        'Kilovatio-hora', 'Vatio',
        'Grado Celsius', 'Grado Fahrenheit'
      )
    `);
  }
}
