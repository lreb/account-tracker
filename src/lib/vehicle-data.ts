/**
 * Static make → models map for the vehicle form.
 * Covers the most common global brands; users can always type a custom value.
 */

export const MODEL_MAP: Record<string, string[]> = {
  'Acura':          ['ILX', 'MDX', 'RDX', 'TLX', 'RLX'],
  'Alfa Romeo':     ['Giulia', 'Giulietta', 'Stelvio', 'Tonale'],
  'Audi':           ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'e-tron', 'Q4 e-tron'],
  'BMW':            ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'i3', 'i4', 'iX'],
  'Chevrolet':      ['Blazer', 'Camaro', 'Colorado', 'Corvette', 'Equinox', 'Malibu', 'Silverado 1500', 'Suburban', 'Tahoe', 'Traverse', 'Trax'],
  'Chrysler':       ['300', 'Pacifica', 'Voyager'],
  'Citroën':        ['Berlingo', 'C3', 'C4', 'C5 X', 'DS3', 'SpaceTourer'],
  'Dodge':          ['Challenger', 'Charger', 'Durango', 'Journey', 'RAM 1500'],
  'Fiat':           ['500', '500X', 'Panda', 'Tipo', 'Doblo'],
  'Ford':           ['Bronco', 'EcoSport', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-250', 'Fiesta', 'Focus', 'Maverick', 'Mustang', 'Ranger', 'Transit'],
  'GMC':            ['Acadia', 'Canyon', 'Sierra 1500', 'Terrain', 'Yukon'],
  'Honda':          ['Accord', 'City', 'Civic', 'CR-V', 'HR-V', 'Jazz', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline'],
  'Hyundai':        ['Accent', 'Elantra', 'i10', 'i20', 'i30', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson'],
  'Infiniti':       ['Q50', 'Q60', 'QX50', 'QX60', 'QX80'],
  'Jaguar':         ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'XE', 'XF'],
  'Jeep':           ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  'Kia':            ['Carnival', 'EV6', 'Forte', 'K5', 'Niro', 'Rio', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride'],
  'Land Rover':     ['Defender', 'Discovery', 'Discovery Sport', 'Freelander', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  'Lexus':          ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RX', 'UX'],
  'Mazda':          ['CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-9', 'Mazda2', 'Mazda3', 'Mazda6', 'MX-5 Miata'],
  'Mercedes-Benz':  ['A-Class', 'B-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'EQA', 'EQB', 'EQC', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Class', 'SL'],
  'Mitsubishi':     ['Eclipse Cross', 'L200', 'Outlander', 'Outlander Sport', 'Pajero'],
  'Nissan':         ['Altima', 'Armada', 'Frontier', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa'],
  'Peugeot':        ['2008', '208', '3008', '308', '5008', '508', 'e-2008'],
  'Porsche':        ['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  'RAM':            ['1500', '2500', '3500', 'ProMaster', 'ProMaster City'],
  'Renault':        ['Arkana', 'Captur', 'Clio', 'Duster', 'Kadjar', 'Megane', 'Trafic', 'Zoe'],
  'SEAT':           ['Arona', 'Ateca', 'Ibiza', 'Leon', 'Tarraco'],
  'Škoda':          ['Fabia', 'Karoq', 'Kodiaq', 'Octavia', 'Scala', 'Superb'],
  'Subaru':         ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'WRX'],
  'Suzuki':         ['Grand Vitara', 'Jimny', 'S-Presso', 'Swift', 'Vitara'],
  'Tesla':          ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y'],
  'Toyota':         ['4Runner', 'Avalon', 'C-HR', 'Camry', 'Corolla', 'Crown', 'GR86', 'Highlander', 'Land Cruiser', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Supra', 'Tacoma', 'Tundra', 'Venza', 'Yaris'],
  'Volkswagen':     ['Arteon', 'Atlas', 'Golf', 'ID.3', 'ID.4', 'ID.5', 'Jetta', 'Passat', 'Polo', 'T-Cross', 'T-Roc', 'Taos', 'Tiguan', 'Touareg'],
  'Volvo':          ['C40', 'EX30', 'EX90', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90'],
}

export const MAKES = Object.keys(MODEL_MAP).sort()
