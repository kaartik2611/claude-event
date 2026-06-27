import personTrackingService from './personTracking.service';
import { getSocketInstance } from '../socket';

// Zone coordinates for simulation (Nashik Kumbh Mela zones)
const ZONE_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  'ZONE-1': { lat: 19.9975, lng: 73.7898, name: 'Zone 1 - Ramkund Ghat' },
  'ZONE-2': { lat: 19.9965, lng: 73.7908, name: 'Zone 2 - Main Bazaar' },
  'ZONE-3': { lat: 20.0000, lng: 73.7850, name: 'Zone 3 - Panchavati' },
  'ZONE-4': { lat: 20.0015, lng: 73.7870, name: 'Zone 4 - Exit Point' },
};

const ZONE_SEQUENCE = ['ZONE-1', 'ZONE-2', 'ZONE-3', 'ZONE-4'];

class SimulationService {
  private simulationInterval: NodeJS.Timeout | null = null;
  private activeSimulations: Set<string> = new Set();

  /**
   * Start simulating a person moving through zones
   */
  async startPersonSimulation(personData: {
    name: string;
    age?: number;
    description?: string;
    photo_url?: string;
  }): Promise<string> {
    // Create person in Zone 1
    const person = await personTrackingService.trackPerson({
      name: personData.name,
      age: personData.age,
      description: personData.description,
      photo_url: personData.photo_url,
      zone: 'ZONE-1',
      gps_lat: ZONE_LOCATIONS['ZONE-1'].lat,
      gps_lng: ZONE_LOCATIONS['ZONE-1'].lng,
    });

    // Emit initial detection
    const io = getSocketInstance();
    if (io) {
      io.to('zone:ZONE-1').emit('person:detected', {
        person_id: person.person_id,
        name: person.name,
        age: person.age,
        description: person.description,
        photo_url: person.photo_url,
        zone: 'ZONE-1',
        zone_name: ZONE_LOCATIONS['ZONE-1'].name,
        gps_lat: person.current_gps_lat,
        gps_lng: person.current_gps_lng,
        timestamp: new Date(),
      });

      // Also emit to admin
      io.to('admin').emit('person:detected', {
        person_id: person.person_id,
        name: person.name,
        age: person.age,
        description: person.description,
        photo_url: person.photo_url,
        zone: 'ZONE-1',
        zone_name: ZONE_LOCATIONS['ZONE-1'].name,
        gps_lat: person.current_gps_lat,
        gps_lng: person.current_gps_lng,
        timestamp: new Date(),
      });
    }

    // Add to active simulations
    this.activeSimulations.add(person.person_id);

    // Start movement simulation (moves every 30 seconds)
    this.simulatePersonMovement(person.person_id);

    return person.person_id;
  }

  /**
   * Simulate gradual movement through zones
   */
  private async simulatePersonMovement(person_id: string) {
    let currentZoneIndex = 0;

    const moveToNextZone = async () => {
      if (!this.activeSimulations.has(person_id)) {
        return; // Simulation stopped
      }

      const person = await personTrackingService.getPersonById(person_id);
      if (!person || person.status !== 'active') {
        this.activeSimulations.delete(person_id);
        return;
      }

      // Find current zone index
      currentZoneIndex = ZONE_SEQUENCE.indexOf(person.current_zone);
      
      // Move to next zone if not at the end
      if (currentZoneIndex < ZONE_SEQUENCE.length - 1) {
        const nextZoneId = ZONE_SEQUENCE[currentZoneIndex + 1];
        const nextZone = ZONE_LOCATIONS[nextZoneId];

        // Move person
        const { person: updatedPerson, movement } = await personTrackingService.movePerson(
          person_id,
          nextZoneId,
          nextZone.lat,
          nextZone.lng,
          'simulated',
          'Auto Simulation',
          0.95
        );

        // Emit movement event via WebSocket
        const io = getSocketInstance();
        if (io) {
          const movementEvent = {
            person_id: updatedPerson.person_id,
            name: updatedPerson.name,
            age: updatedPerson.age,
            description: updatedPerson.description,
            photo_url: updatedPerson.photo_url,
            from_zone: person.current_zone,
            from_zone_name: ZONE_LOCATIONS[person.current_zone]?.name,
            to_zone: nextZoneId,
            to_zone_name: nextZone.name,
            from_lat: movement.from_lat,
            from_lng: movement.from_lng,
            to_lat: movement.to_lat,
            to_lng: movement.to_lng,
            detection_method: 'simulated',
            confidence: 0.95,
            timestamp: new Date(),
          };

          // Emit to both zones and admin
          io.to(`zone:${person.current_zone}`).emit('person:left', movementEvent);
          io.to(`zone:${nextZoneId}`).emit('person:entered', movementEvent);
          io.to('admin').emit('person:moved', movementEvent);
        }

        console.log(`🚶 ${person.name} moved: ${person.current_zone} → ${nextZoneId}`);

        // Schedule next movement in 30 seconds
        setTimeout(moveToNextZone, 30000);
      } else {
        // Reached final zone - mark as resolved
        await personTrackingService.updatePersonStatus(person_id, 'resolved');
        this.activeSimulations.delete(person_id);
        
        const io = getSocketInstance();
        if (io) {
          io.to('admin').emit('person:completed', {
            person_id,
            name: person.name,
            final_zone: person.current_zone,
            timestamp: new Date(),
          });
        }
        
        console.log(`✅ ${person.name} completed journey at ${person.current_zone}`);
      }
    };

    // Start movement after 30 seconds
    setTimeout(moveToNextZone, 30000);
  }

  /**
   * Stop simulation for a person
   */
  async stopSimulation(person_id: string) {
    this.activeSimulations.delete(person_id);
    await personTrackingService.updatePersonStatus(person_id, 'inactive');
  }

  /**
   * Get all active simulations
   */
  getActiveSimulations(): string[] {
    return Array.from(this.activeSimulations);
  }

  /**
   * Simulate multiple people at once (for demo)
   */
  async simulateCrowd(count: number = 3) {
    const names = [
      'Rajesh Kumar',
      'Priya Sharma',
      'Amit Patel',
      'Sneha Desai',
      'Vikram Singh',
      'Anita Reddy',
      'Suresh Yadav',
      'Meera Joshi',
      'Karan Mehta',
      'Divya Nair',
    ];

    const personIds: string[] = [];

    for (let i = 0; i < Math.min(count, names.length); i++) {
      const person_id = await this.startPersonSimulation({
        name: names[i],
        age: Math.floor(Math.random() * 50) + 20,
        description: `Simulated person ${i + 1}`,
      });
      personIds.push(person_id);
      
      // Stagger starts by 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return personIds;
  }

  /**
   * Manually move a person to a specific zone (for testing)
   */
  async manuallyMovePerson(
    person_id: string,
    to_zone: string,
    detection_method: 'cctv' | 'manual' | 'sherlock' = 'manual'
  ) {
    const zone = ZONE_LOCATIONS[to_zone];
    if (!zone) {
      throw new Error(`Invalid zone: ${to_zone}`);
    }

    const { person, movement } = await personTrackingService.movePerson(
      person_id,
      to_zone,
      zone.lat,
      zone.lng,
      detection_method,
      'Manual Override'
    );

    // Emit via WebSocket
    const io = getSocketInstance();
    if (io) {
      const movementEvent = {
        person_id: person.person_id,
        name: person.name,
        from_zone: movement.from_zone,
        to_zone: movement.to_zone,
        to_zone_name: zone.name,
        from_lat: movement.from_lat,
        from_lng: movement.from_lng,
        to_lat: movement.to_lat,
        to_lng: movement.to_lng,
        detection_method,
        timestamp: new Date(),
      };

      io.to(`zone:${movement.from_zone}`).emit('person:left', movementEvent);
      io.to(`zone:${to_zone}`).emit('person:entered', movementEvent);
      io.to('admin').emit('person:moved', movementEvent);
    }

    return { person, movement };
  }
}

export default new SimulationService();
