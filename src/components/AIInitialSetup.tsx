const skipSetup = () => {
    localStorage.setItem('initialSetupCompleted', 'true');
    onSetupComplete();
  };

  // Built-in AI setup functions
  const analyzeHome = async (entities: Entity[], preferences: any) => {
    const deviceTypes = {
      lights: entities.filter(e => e.entity_id.startsWith('light.')).length,
      switches: entities.filter(e => e.entity_id.startsWith('switch.')).length,
      sensors: entities.filter(e => e.entity_id.startsWith('sensor.')).length,
      climate: entities.filter(e => e.entity_id.startsWith('climate.')).length,
      media: entities.filter(e => e.entity_id.startsWith('media_player.')).length
    };

    return {
      totalDevices: entities.length,
      deviceTypes,
      estimatedRooms: Math.max(3, Math.ceil(deviceTypes.lights / 3)),
      homeProfile: {
        size: deviceTypes.lights > 15 ? 'large' : deviceTypes.lights > 8 ? 'medium' : 'small',
        techLevel: entities.length > 50 ? 'advanced' : entities.length > 20 ? 'intermediate' : 'basic'
      }
    };
  };

  const createRooms = async (entities: Entity[], analysis: any) => {
    const rooms = [
      {
        id: 'living_room',
        name: 'Living Room',
        entities: entities.filter(e => e.friendly_name?.toLowerCase().includes('living')).map(e => e.entity_id)
      },
      {
        id: 'bedroom',
        name: 'Bedroom',
        entities: entities.filter(e => e.friendly_name?.toLowerCase().includes('bedroom')).map(e => e.entity_id)
      },
      {
        id: 'kitchen',
        name: 'Kitchen',
        entities: entities.filter(e => e.friendly_name?.toLowerCase().includes('kitchen')).map(e => e.entity_id)
      }
    ];
    
    localStorage.setItem('rooms', JSON.stringify(rooms));
    return { rooms };
  };

  const createDashboards = async (entities: Entity[], rooms: any[]) => {
    const dashboards = [
      {
        id: 'overview',
        name: 'Home Overview',
        description: 'Main dashboard with essential controls',
        cards: [],
        isPinned: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    localStorage.setItem('dashboards', JSON.stringify(dashboards));
    return { dashboards };
  };

  const createAutomations = async (entities: Entity[], preferences: any) => {
    const automations = [
      {
        id: 'energy_optimization',
        name: 'Energy Optimization',
        description: 'Optimize energy usage based on solar and battery',
        enabled: true,
        triggerCount: 0
      }
    ];
    
    localStorage.setItem('automations', JSON.stringify(automations));
    return { automations };
  };

  const configureEnergy = async (entities: Entity[]) => {
    const energyMapping = {
      solar: entities.filter(e => e.entity_id.includes('solar')).map(e => e.entity_id),
      battery: entities.filter(e => e.entity_id.includes('battery')).map(e => e.entity_id),
      ev: entities.filter(e => e.entity_id.includes('ev') || e.entity_id.includes('car')).map(e => e.entity_id),
      grid: entities.filter(e => e.entity_id.includes('grid')).map(e => e.entity_id)
    };
    
    localStorage.setItem('energyMapping', JSON.stringify(energyMapping));
    return { energyMapping, mappedEntities: entities.length };
  };